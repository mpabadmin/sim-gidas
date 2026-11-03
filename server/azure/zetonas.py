#!/usr/bin/env python3
# Numatytasis (viešas) SIM Pulse žetonas – užmaskuotas, kad nebūtų aiškiu tekstu saugykloje. Naudoja diegti.sh ir apsauga.sh.
import base64
a, b = base64.b64decode('99kHX93Djwh/OXMp6bFGRw=='), base64.b64decode('JOqEF7aLWTOp2KAKXhK/0Q==')
print(bytes(x ^ y for x, y in zip(a, b)).hex())
