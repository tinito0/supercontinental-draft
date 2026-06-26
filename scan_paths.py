import os, re

files = []
for root, dirs, fnames in os.walk('.'):
    dirs[:] = [d for d in dirs if d not in ('node_modules', 'dist', '.git')]
    for f in fnames:
        if f.endswith(('.jsx', '.js')):
            files.append(os.path.join(root, f))

pattern = re.compile(r'''(?:collection|doc)\(\s*db\s*,\s*['"]([^'"]+)['"]''')

for fp in files:
    try:
        with open(fp, 'r', encoding='utf-8') as fh:
            for i, line in enumerate(fh, 1):
                for m in pattern.finditer(line):
                    path = m.group(1)
                    if not path.startswith('artifacts/'):
                        print(f'{os.path.basename(fp)}:{i}: {path}')
    except:
        pass
