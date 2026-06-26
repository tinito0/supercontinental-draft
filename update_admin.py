with open('components/AdminModal.jsx', 'r', encoding='utf-8') as f:
    code = f.read()

code = code.replace("['open', 'closed', 'scheduled'].map((status) =>", "['open', 'closed', 'scheduled', 'FranchiseMarket'].map((status) =>")
code = code.replace("{status === 'scheduled' && '⏳ Programado'}", "{status === 'scheduled' && '⏳ Programado'}\n                {status === 'FranchiseMarket' && '🌟 Mercado Franquicia'}")
code = code.replace("{status === 'scheduled' && '?? Programado'}", "{status === 'scheduled' && '?? Programado'}\n                {status === 'FranchiseMarket' && '🌟 Mercado Franquicia'}")

with open('components/AdminModal.jsx', 'w', encoding='utf-8') as f:
    f.write(code)
