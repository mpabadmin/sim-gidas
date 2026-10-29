"""Minimalus HTTP + WebSocket (RFC 6455) serveris tik su Python standartine biblioteka.

Kodėl ne `websockets` biblioteka: Kitware Pulse Docker atvaizde gali nebūti pip / tinkamos Python versijos
paketų, todėl serveris neturi jokių išorinių priklausomybių.
Palaiko: GET užklausas (JSON / tekstas), WebSocket teksto kadrus, fragmentaciją, ping/pong, uždarymą.
"""
import asyncio
import base64
import hashlib
import json
import struct
from urllib.parse import urlsplit, parse_qs

GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'
MAX_MSG = 256 * 1024


class WSClosed(Exception):
    pass


class WebSocket:
    def __init__(self, reader, writer, path, query, headers):
        self.r, self.w, self.path, self.query, self.headers = reader, writer, path, query, headers
        self.closed = False
        self._lock = asyncio.Lock()

    async def send(self, obj):
        if self.closed:
            raise WSClosed()
        data = (obj if isinstance(obj, str) else json.dumps(obj, ensure_ascii=False, separators=(',', ':'))).encode()
        n = len(data)
        head = bytes([0x81]) + (bytes([n]) if n < 126 else bytes([126]) + struct.pack('>H', n) if n < 65536 else bytes([127]) + struct.pack('>Q', n))
        async with self._lock:
            try:
                self.w.write(head + data)
                await self.w.drain()
            except Exception:
                self.closed = True
                raise WSClosed()

    async def _frame(self):
        h = await self.r.readexactly(2)
        fin, op, masked, n = h[0] & 0x80, h[0] & 0x0F, h[1] & 0x80, h[1] & 0x7F
        if n == 126:
            n = struct.unpack('>H', await self.r.readexactly(2))[0]
        elif n == 127:
            n = struct.unpack('>Q', await self.r.readexactly(8))[0]
        if n > MAX_MSG:
            raise WSClosed()
        mask = await self.r.readexactly(4) if masked else b''
        data = bytearray(await self.r.readexactly(n))
        if masked:
            for i in range(n):
                data[i] ^= mask[i & 3]
        return bool(fin), op, bytes(data)

    async def recv(self):
        """Grąžina kitą teksto žinutę (str). Kelia WSClosed, kai ryšys uždaromas."""
        buf, first = b'', None
        while True:
            try:
                fin, op, data = await self._frame()
            except (asyncio.IncompleteReadError, ConnectionError, OSError):
                self.closed = True
                raise WSClosed()
            if op == 0x8:  # close
                await self.close()
                raise WSClosed()
            if op == 0x9:  # ping → pong
                async with self._lock:
                    try:
                        self.w.write(bytes([0x8A, len(data)]) + data[:125])
                        await self.w.drain()
                    except Exception:
                        pass
                continue
            if op == 0xA:
                continue
            if op in (0x1, 0x2):
                first, buf = op, data
            elif op == 0x0:
                buf += data
            if len(buf) > MAX_MSG:
                raise WSClosed()
            if fin:
                return buf.decode('utf-8', 'replace')

    async def close(self, code=1000):
        if self.closed:
            return
        self.closed = True
        try:
            self.w.write(bytes([0x88, 2]) + struct.pack('>H', code))
            await self.w.drain()
        except Exception:
            pass
        try:
            self.w.close()
        except Exception:
            pass


async def serve(host, port, on_ws, on_http):
    """on_ws(ws) – korutina WebSocket ryšiui; on_http(path, query) → (status, content_type, body_bytes)."""

    async def handle(reader, writer):
        try:
            line = await asyncio.wait_for(reader.readline(), 15)
            if not line:
                writer.close()
                return
            method, target, _ = line.decode('latin-1').split(' ', 2)
            headers = {}
            while True:
                h = await asyncio.wait_for(reader.readline(), 15)
                if h in (b'\r\n', b'\n', b''):
                    break
                k, _, v = h.decode('latin-1').partition(':')
                headers[k.strip().lower()] = v.strip()
            u = urlsplit(target)
            query = {k: v[0] for k, v in parse_qs(u.query).items()}
            cors = 'Access-Control-Allow-Origin: *\r\nAccess-Control-Allow-Headers: *\r\n'
            if headers.get('upgrade', '').lower() == 'websocket':
                key = headers.get('sec-websocket-key', '')
                acc = base64.b64encode(hashlib.sha1((key + GUID).encode()).digest()).decode()
                writer.write(('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n'
                              f'Sec-WebSocket-Accept: {acc}\r\n\r\n').encode())
                await writer.drain()
                ws = WebSocket(reader, writer, u.path, query, headers)
                try:
                    await on_ws(ws)
                finally:
                    await ws.close()
                return
            if method == 'OPTIONS':
                writer.write(('HTTP/1.1 204 No Content\r\n' + cors + 'Content-Length: 0\r\n\r\n').encode())
            else:
                status, ctype, body = await on_http(u.path, query)
                writer.write((f'HTTP/1.1 {status}\r\nContent-Type: {ctype}\r\nContent-Length: {len(body)}\r\n'
                              f'Cache-Control: no-store\r\n{cors}Connection: close\r\n\r\n').encode() + body)
            await writer.drain()
            writer.close()
        except Exception:
            try:
                writer.close()
            except Exception:
                pass

    return await asyncio.start_server(handle, host, port)
