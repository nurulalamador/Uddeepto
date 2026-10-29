import re,glob
skip={'components/text.tsx','components/ui.tsx'}
for f in glob.glob('**/*.tsx',recursive=True):
    f=f.replace(chr(92),'/')
    if f in skip: continue
    s=open(f,encoding='utf8').read()
    m=re.search(r'import \{([^}]*)\} from "react-native";',s)
    if not m: continue
    names=[n.strip() for n in m.group(1).split(',') if n.strip()]
    mv=[n for n in names if n in('Text','TextInput')]
    if not mv: continue
    rest=[n for n in names if n not in mv]
    s=s.replace(m.group(0),('import { %s } from "react-native";'%', '.join(rest)) if rest else '',1)
    uipath='./ui' if f.startswith('components/') else '@/components/ui'
    m2=re.search(r'import \{([^}]*)\} from "%s";'%re.escape(uipath),s)
    if m2:
        cur=[n.strip() for n in m2.group(1).split(',') if n.strip()]
        s=s.replace(m2.group(0),'import { %s } from "%s";'%(', '.join(cur+mv),uipath),1)
    else:
        s='import { %s } from "%s";\n'%(', '.join(mv),uipath)+s
    open(f,'w',encoding='utf8').write(s)
    print('fixed',f)
