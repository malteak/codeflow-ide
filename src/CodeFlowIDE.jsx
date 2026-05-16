import { useState, useRef, useEffect, useCallback } from "react";

const THEMES = {
  dark: {
    bg: "#0d1117", surface: "#161b22", border: "#30363d",
    text: "#e6edf3", muted: "#8b949e", accent: "#58a6ff",
    green: "#3fb950", red: "#f85149", orange: "#d29922",
    purple: "#bc8cff", sidebar: "#0d1117", lineNum: "#484f58",
    selection: "#1f3a5c", keyword: "#ff7b72", string: "#a5d6ff",
    comment: "#6e7681", func: "#d2a8ff", number: "#79c0ff",
  },
  light: {
    bg: "#ffffff", surface: "#f6f8fa", border: "#d0d7de",
    text: "#1f2328", muted: "#656d76", accent: "#0969da",
    green: "#1a7f37", red: "#cf222e", orange: "#9a6700",
    purple: "#8250df", sidebar: "#f6f8fa", lineNum: "#8c959f",
    selection: "#b3d7ff", keyword: "#cf222e", string: "#0a3069",
    comment: "#57606a", func: "#8250df", number: "#0550ae",
  }
};

const SAMPLE_FILES = {
  "app.jsx": `import React, { useState } from 'react';\n\nconst App = () => {\n  const [count, setCount] = useState(0);\n  const [message, setMessage] = useState('');\n\n  const handleClick = () => {\n    setCount(prev => prev + 1);\n    setMessage(\`Нажато \${count + 1} раз!\`);\n  };\n\n  return (\n    <div className=\"app\">\n      <h1>CodeFlow App</h1>\n      <p>{message || 'Нажми кнопку!'}</p>\n      <button onClick={handleClick}>\n        Нажми меня\n      </button>\n    </div>\n  );\n};\n\nexport default App;`,
  "styles.css": `/* Основные стили */\n* {\n  margin: 0;\n  padding: 0;\n  box-sizing: border-box;\n}\n\nbody {\n  font-family: 'SF Pro Display', system-ui;\n  background: #0d1117;\n  color: #e6edf3;\n  min-height: 100vh;\n}\n\n.app {\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  padding: 2rem;\n  gap: 1rem;\n}`,
  "README.md": `# CodeFlow Project\n\nМобильное приложение с AI-ассистентом.\n\n## Стек\n- React 18\n- AI (Claude API)\n- GitHub интеграция\n- Python поддержка\n`,
  "main.py": `# Python пример\nimport os\nimport json\nfrom typing import List, Dict, Optional\n\ndef greet(name: str) -> str:\n    """Возвращает приветствие"""\n    return f"Привет, {name}!"\n\nclass DataProcessor:\n    def __init__(self, data: List[Dict]):\n        self.data = data\n        self.processed = False\n\n    def process(self) -> List[Dict]:\n        result = []\n        for item in self.data:\n            if item.get('active', False):\n                result.append(item)\n        self.processed = True\n        return result\n\nif __name__ == '__main__':\n    print(greet("CodeFlow"))\n`,
};

const FILE_ICONS = {
  js: "⚡", jsx: "⚛", ts: "🔷", tsx: "⚛", css: "🎨",
  html: "🌐", json: "📋", md: "📝", py: "🐍", default: "📄"
};

const PYTHON_KEYWORDS = ['False','None','True','and','as','assert','async','await','break','class','continue','def','del','elif','else','except','finally','for','from','global','if','import','in','is','lambda','nonlocal','not','or','pass','raise','return','try','while','with','yield'];
const PYTHON_BUILTINS = ['abs','all','any','bin','bool','bytes','callable','chr','dict','dir','divmod','enumerate','eval','exec','filter','float','format','frozenset','getattr','globals','hasattr','hash','help','hex','id','input','int','isinstance','issubclass','iter','len','list','locals','map','max','min','next','object','oct','open','ord','pow','print','property','range','repr','reversed','round','set','setattr','slice','sorted','staticmethod','str','sum','super','tuple','type','vars','zip'];
const JS_KEYWORDS = ['const','let','var','function','return','import','export','default','class','if','else','for','while','async','await','new','this','typeof','null','undefined','true','false','throw','try','catch','of','in','switch','case','break','continue','extends','super','static','get','set','delete','void','instanceof','yield','from','Promise','console','window','document','Array','Object','String','Number','Boolean','Math','JSON','Error'];

function getExt(name) { return (name || '').split('.').pop().toLowerCase(); }
function getIcon(name) { return FILE_ICONS[getExt(name)] || FILE_ICONS.default; }

function highlight(code, filename, t) {
  const ext = getExt(filename);
  let out = escHtml(code);
  if (ext === 'py') {
    out = out.replace(/(#[^\n]*)/g, `<span style="color:${t.comment}">$1</span>`);
    out = out.replace(/([f"'])([^"'\n]*)(\1)/g, `<span style="color:${t.string}">$1$2$3</span>`);
    out = out.replace(/\b(False|None|True|and|as|assert|async|await|break|class|continue|def|del|elif|else|except|finally|for|from|global|if|import|in|is|lambda|nonlocal|not|or|pass|raise|return|try|while|with|yield)\b/g,
      `<span style="color:${t.keyword}">$1</span>`);
    out = out.replace(/\b(def|class)\b([^<]*?)([a-zA-Z_]\w*)/g,
      (m, kw, sp, name) => `<span style="color:${t.keyword}">${kw}</span>${sp}<span style="color:${t.func}">${name}</span>`);
    out = out.replace(/\b(print|len|range|type|int|str|float|list|dict|tuple|set|bool|input|open|abs|max|min|sum|zip|map|filter|enumerate|sorted|reversed|isinstance|hasattr|getattr|setattr)\b/g,
      `<span style="color:${t.purple}">$1</span>`);
    out = out.replace(/\b(\d+\.?\d*)\b/g, `<span style="color:${t.number}">$1</span>`);
  } else if (['js','jsx','ts','tsx'].includes(ext)) {
    out = out.replace(/(\/\/.+)/g, `<span style="color:${t.comment}">$1</span>`);
    out = out.replace(/(["`'])([^"`'\n]*)(\1)/g, `<span style="color:${t.string}">$1$2$3</span>`);
    out = out.replace(/\b(const|let|var|function|return|import|export|default|class|if|else|for|while|async|await|new|this|typeof|null|undefined|true|false|throw|try|catch|of|in|switch|case|break|continue|extends|super|static|from|yield)\b/g,
      `<span style="color:${t.keyword}">$1</span>`);
    out = out.replace(/\b([A-Z][a-zA-Z0-9]*)\b/g, `<span style="color:${t.func}">$1</span>`);
    out = out.replace(/\b(\d+\.?\d*)\b/g, `<span style="color:${t.number}">$1</span>`);
  } else if (ext === 'css') {
    out = out.replace(/(\/\*[\s\S]*?\*\/)/g, `<span style="color:${t.comment}">$1</span>`);
    out = out.replace(/([.#]?[a-zA-Z][a-zA-Z0-9_-]*)\s*\{/g, `<span style="color:${t.func}">$1</span> {`);
    out = out.replace(/([a-z-]+)\s*:/g, `<span style="color:${t.keyword}">$1</span>:`);
    out = out.replace(/(#[0-9a-fA-F]{3,8})/g, `<span style="color:${t.orange}">$1</span>`);
  }
  return out;
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function getCompletions(code, cursorPos, filename) {
  const ext = getExt(filename);
  const before = code.substring(0, cursorPos);
  const wordMatch = before.match(/([a-zA-Z_]\w*)$/);
  if (!wordMatch || wordMatch[1].length < 2) return [];
  const prefix = wordMatch[1];
  let pool = [];
  if (ext === 'py') pool = [...PYTHON_KEYWORDS, ...PYTHON_BUILTINS];
  else if (['js','jsx','ts','tsx'].includes(ext)) pool = JS_KEYWORDS;
  else return [];
  const identifiers = [...code.matchAll(/\b([a-zA-Z_]\w{2,})\b/g)].map(m => m[1]);
  pool = [...new Set([...pool, ...identifiers])];
  return pool.filter(w => w.startsWith(prefix) && w !== prefix).slice(0, 6);
}

async function openFileFromDisk() {
  return new Promise(resolve => {
    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.js,.jsx,.ts,.tsx,.py,.css,.html,.json,.md,.txt,.csv,.xml,.yaml,.yml,.sh,.rb,.go,.rs,.cpp,.c,.h';
      input.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0;';
      document.body.appendChild(input);
      let resolved = false;
      const cleanup = () => {
        try { if (document.body.contains(input)) document.body.removeChild(input); } catch(e) {}
      };
      input.onchange = async (e) => {
        if (resolved) return;
        resolved = true;
        try {
          const file = e.target.files && e.target.files[0];
          cleanup();
          if (!file) return resolve(null);
          const text = await file.text();
          resolve({ name: file.name, content: text, handle: null });
        } catch(err) { cleanup(); resolve(null); }
      };
      // fallback timeout — if nothing happens in 5 min, resolve null
      setTimeout(() => { if (!resolved) { resolved = true; cleanup(); resolve(null); } }, 300000);
      input.click();
    } catch(e) { resolve(null); }
  });
}

async function saveFileToDisk(content, filename, handle) {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); document.body.removeChild(a); }, 100);
  return null;
}

function GitHubModal({ t, onClose, onConnect }) {
  const [step, setStep] = useState(1);
  const [token, setToken] = useState('');
  const [repo, setRepo] = useState('');
  const [loading, setLoading] = useState(false);
  const [branches] = useState(['main', 'develop', 'feature/ai-assistant']);
  const [selectedBranch, setSelectedBranch] = useState('main');

  const doConnect = async () => {
    if (!token.trim()) return;
    setLoading(true);
    await new Promise(r => setTimeout(r, 1400));
    setLoading(false);
    setStep(2);
  };

  const doClone = async () => {
    setLoading(true);
    await new Promise(r => setTimeout(r, 1800));
    setLoading(false);
    onConnect({ token, repo, branch: selectedBranch });
    onClose();
  };

  return (
    <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.75)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(6px)',padding:20 }}>
      <div style={{ background:t.surface,border:`1px solid ${t.border}`,borderRadius:16,padding:24,width:'100%',maxWidth:340,boxShadow:'0 24px 80px rgba(0,0,0,0.6)' }}>
        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20 }}>
          <span style={{ color:t.text,fontWeight:700,fontSize:16 }}>🐙 GitHub</span>
          <button onClick={onClose} style={{ background:'none',border:'none',color:t.muted,cursor:'pointer',fontSize:20 }}>✕</button>
        </div>
        <div style={{ display:'flex',gap:6,marginBottom:20 }}>
          {[1,2].map(s => <div key={s} style={{ flex:1,height:3,borderRadius:2,background:step>=s?t.accent:t.border,transition:'background 0.3s' }}/>)}
        </div>
        {step === 1 && <>
          <p style={{ color:t.text,fontWeight:600,fontSize:14,marginBottom:6 }}>Personal Access Token</p>
          <p style={{ color:t.muted,fontSize:12,marginBottom:14,lineHeight:1.6 }}>Settings → Developer settings → Personal access tokens. Нужны права: repo, workflow.</p>
          <input type="password" value={token} onChange={e=>setToken(e.target.value)} placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
            style={{ width:'100%',padding:'10px 12px',background:t.bg,border:`1px solid ${t.border}`,borderRadius:8,color:t.text,fontSize:13,outline:'none',fontFamily:'monospace',marginBottom:8 }}/>
          <button onClick={doConnect} disabled={loading||!token.trim()}
            style={{ width:'100%',padding:11,background:token.trim()?'#238636':t.border,border:'none',borderRadius:8,color:'white',fontSize:14,fontWeight:600,cursor:token.trim()?'pointer':'default' }}>
            {loading?'⏳ Подключение...':'🔗 Подключить аккаунт'}
          </button>
        </>}
        {step === 2 && <>
          <div style={{ background:'rgba(63,185,80,0.12)',border:'1px solid rgba(63,185,80,0.4)',borderRadius:8,padding:'10px 14px',marginBottom:16,display:'flex',alignItems:'center',gap:8 }}>
            <span>✅</span>
            <div><div style={{ color:t.green,fontSize:13,fontWeight:600 }}>GitHub подключён!</div><div style={{ color:t.muted,fontSize:11 }}>Авторизация прошла успешно</div></div>
          </div>
          <p style={{ color:t.muted,fontSize:12,marginBottom:8 }}>Клонировать репозиторий (необязательно):</p>
          <input value={repo} onChange={e=>setRepo(e.target.value)} placeholder="username/repo-name"
            style={{ width:'100%',padding:'10px 12px',background:t.bg,border:`1px solid ${t.border}`,borderRadius:8,color:t.text,fontSize:13,outline:'none',fontFamily:'monospace',marginBottom:8 }}/>
          {repo && <div style={{ marginBottom:12 }}>
            <p style={{ color:t.muted,fontSize:12,marginBottom:6 }}>Ветка:</p>
            <div style={{ display:'flex',gap:6,flexWrap:'wrap' }}>
              {branches.map(b => <button key={b} onClick={()=>setSelectedBranch(b)}
                style={{ padding:'5px 10px',borderRadius:20,fontSize:11,cursor:'pointer',background:selectedBranch===b?t.accent:'none',border:`1px solid ${selectedBranch===b?t.accent:t.border}`,color:selectedBranch===b?'white':t.muted }}>{b}</button>)}
            </div>
          </div>}
          <div style={{ display:'flex',gap:8 }}>
            <button onClick={onClose} style={{ flex:1,padding:10,background:'none',border:`1px solid ${t.border}`,borderRadius:8,color:t.muted,fontSize:13,cursor:'pointer' }}>Пропустить</button>
            <button onClick={repo?doClone:onClose} style={{ flex:2,padding:10,background:repo?'#238636':t.accent,border:'none',borderRadius:8,color:'white',fontSize:13,fontWeight:600,cursor:'pointer' }}>
              {loading?'⏳...':repo?'📥 Клонировать':'✓ Готово'}
            </button>
          </div>
        </>}
      </div>
    </div>
  );
}

function CommitModal({ t, onClose, files, onCommit }) {
  const [msg, setMsg] = useState('');
  const [selected, setSelected] = useState(Object.keys(files));
  const [loading, setLoading] = useState(false);
  const toggle = f => setSelected(prev => prev.includes(f)?prev.filter(x=>x!==f):[...prev,f]);
  const doCommit = async () => {
    if (!msg.trim()||!selected.length) return;
    setLoading(true);
    await new Promise(r=>setTimeout(r,1500));
    setLoading(false);
    onCommit(msg,selected);
    onClose();
  };
  return (
    <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:200,display:'flex',alignItems:'flex-end',backdropFilter:'blur(4px)' }}>
      <div style={{ background:t.surface,borderRadius:'16px 16px 0 0',border:`1px solid ${t.border}`,padding:20,width:'100%',boxShadow:'0 -20px 60px rgba(0,0,0,0.5)',animation:'slideUp 0.25s ease' }}>
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16 }}>
          <span style={{ color:t.text,fontWeight:700,fontSize:15 }}>💾 Создать коммит</span>
          <button onClick={onClose} style={{ background:'none',border:'none',color:t.muted,cursor:'pointer',fontSize:20 }}>✕</button>
        </div>
        <div style={{ display:'flex',flexDirection:'column',gap:6,marginBottom:14 }}>
          {Object.keys(files).map(f => (
            <label key={f} style={{ display:'flex',alignItems:'center',gap:10,cursor:'pointer' }}>
              <input type="checkbox" checked={selected.includes(f)} onChange={()=>toggle(f)} style={{ width:16,height:16,accentColor:t.accent }}/>
              <span style={{ fontSize:13,color:selected.includes(f)?t.text:t.muted }}>{getIcon(f)} {f}</span>
              <span style={{ marginLeft:'auto',fontSize:11,color:t.orange }}>M</span>
            </label>
          ))}
        </div>
        <input value={msg} onChange={e=>setMsg(e.target.value)} placeholder="Описание изменений..."
          style={{ width:'100%',padding:'10px 14px',background:t.bg,border:`1px solid ${msg?t.accent:t.border}`,borderRadius:8,color:t.text,fontSize:13,outline:'none',marginBottom:12 }}/>
        <button onClick={doCommit} disabled={loading||!msg.trim()||!selected.length}
          style={{ width:'100%',padding:12,background:msg.trim()?'#238636':t.border,border:'none',borderRadius:8,color:'white',fontSize:14,fontWeight:600,cursor:msg.trim()?'pointer':'default' }}>
          {loading?'⏳ Коммит...':'✓ Commit & Push'}
        </button>
      </div>
    </div>
  );
}

function AIPanel({ t, currentFile, currentCode, onClose, onInsertCode }) {
  const [msgs, setMsgs] = useState([
    { role:'ai', text:'👋 Привет! Я AI-ассистент CodeFlow.\n\nМогу:\n• Объяснить и улучшить код (JS, Python и др.)\n• Найти баги и написать тесты\n• Анализировать скриншоты 📸\n• Читать прикреплённые файлы 📎\n\nЧто делаем?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:'smooth' }); }, [msgs, loading]);

  const fileToBase64 = file => new Promise((res,rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(',')[1]);
    r.onerror = rej;
    r.readAsDataURL(file);
  });

  const handleAttach = async (e) => {
    const files = Array.from(e.target.files || []);
    const newAtts = [];
    for (const file of files) {
      if (file.type.startsWith('image/')) {
        const data = await fileToBase64(file);
        newAtts.push({ type:'image', name:file.name, data, mediaType:file.type });
      } else {
        const content = await file.text().catch(() => null);
        if (content !== null) newAtts.push({ type:'text', name:file.name, content });
      }
    }
    setAttachments(prev => [...prev, ...newAtts]);
    e.target.value = '';
  };

  const handleScreenshot = async () => {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      alert('Скриншот недоступен — прикрепите изображение вручную (📎)');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video:true });
      const track = stream.getVideoTracks()[0];
      const cap = new ImageCapture(track);
      const bitmap = await cap.grabFrame();
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width; canvas.height = bitmap.height;
      canvas.getContext('2d').drawImage(bitmap, 0, 0);
      const data = canvas.toDataURL('image/png').split(',')[1];
      track.stop();
      setAttachments(prev => [...prev, { type:'image', name:'screenshot.png', data, mediaType:'image/png' }]);
    } catch(e) {}
  };

  const removeAttachment = idx => setAttachments(prev => prev.filter((_,i)=>i!==idx));

  const send = async (text) => {
    const q = (text || input).trim();
    if ((!q && !attachments.length) || loading) return;
    const atts = [...attachments];
    setInput(''); setAttachments([]);
    const displayLines = [q, ...atts.map(a=>`📎 ${a.name}`)].filter(Boolean);
    setMsgs(prev => [...prev, { role:'user', text:displayLines.join('\n'), attachments:atts }]);
    setLoading(true);

    try {
      const history = msgs.filter((_,i)=>i>0).map(m=>({ role:m.role==='ai'?'assistant':'user', content:m.text }));
      const userContent = [];
      for (const att of atts) {
        if (att.type==='image') userContent.push({ type:'image', source:{ type:'base64', media_type:att.mediaType, data:att.data } });
        else userContent.push({ type:'text', text:`[Файл: ${att.name}]\n\`\`\`\n${att.content}\n\`\`\`` });
      }
      if (q) userContent.push({ type:'text', text:q });

      const systemPrompt = `Ты AI-ассистент в редакторе кода CodeFlow IDE.\nТекущий файл: ${currentFile}\nКод:\n\`\`\`\n${currentCode?.substring(0,3000)}\n\`\`\`\nАнализируй скриншоты и файлы. Отвечай кратко, используй блоки кода. Язык ответа — тот, на котором спрашивают.`;

      const messages = [
        { role: 'system', content: systemPrompt },
        ...history.map(m => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.content })),
        { role: 'user', content: q }
      ];

      const res = await fetch('https://gemini-proxy.fishovivan20.workers.dev', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages })
      });
      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content || '⚠️ Нет ответа';
      setMsgs(prev => [...prev, { role:'ai', text:reply }]);
    } catch {
      setMsgs(prev => [...prev, { role:'ai', text:'⚠️ Ошибка соединения с AI.' }]);
    }
    setLoading(false);
  };

  const quick = ['Объясни код','Найди баги','Напиши тесты','Рефакторинг','Добавь типы'];

  const renderAIMessage = (text) => {
    const parts = text.split(/(```[\s\S]*?```)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('```')) {
        const lines = part.split('\n');
        const lang = lines[0].replace('```', '').trim();
        const codeText = lines.slice(1, -1).join('\n');
        return (
          <div key={idx} style={{ marginTop:6, marginBottom:6 }}>
            <div style={{ background:'#0d1117', border:`1px solid ${t.border}`, borderRadius:8, overflow:'hidden' }}>
              {lang && <div style={{ padding:'4px 10px', fontSize:10, color:t.muted, borderBottom:`1px solid ${t.border}` }}>{lang}</div>}
              <pre style={{ margin:0, padding:'10px 12px', fontSize:11, lineHeight:1.6, color:t.text, overflowX:'auto', whiteSpace:'pre' }}>{codeText}</pre>
            </div>
            <button onClick={() => onInsertCode && onInsertCode(codeText)}
              style={{ marginTop:4, padding:'5px 14px', background:t.accent, border:'none', borderRadius:6, color:'white', fontSize:11, cursor:'pointer', fontWeight:600 }}>
              ↙ Вставить в редактор
            </button>
          </div>
        );
      }
      return <span key={idx}>{part}</span>;
    });
  };

  return (
    <div style={{ position:'fixed',inset:0,background:t.surface,zIndex:150,display:'flex',flexDirection:'column',animation:'slideUp 0.2s ease' }}>
      <div style={{ padding:'12px 16px',background:t.bg,borderBottom:`1px solid ${t.border}`,display:'flex',alignItems:'center',gap:10,paddingTop:`max(12px, env(safe-area-inset-top))` }}>
        <button onClick={onClose} style={{ background:'none',border:'none',color:t.muted,cursor:'pointer',fontSize:20,padding:4 }}>←</button>
        <div style={{ display:'flex',alignItems:'center',gap:8,flex:1 }}>
          <div style={{ width:10,height:10,borderRadius:'50%',background:t.green,boxShadow:`0 0 8px ${t.green}` }}/>
          <span style={{ color:t.text,fontWeight:700,fontSize:15 }}>AI Ассистент</span>
        </div>
        <div style={{ padding:'3px 8px',background:'rgba(88,166,255,0.15)',border:`1px solid rgba(88,166,255,0.3)`,borderRadius:20,fontSize:10,color:t.accent }}>gemini-2.0-flash</div>
      </div>

      <div style={{ padding:'6px 16px',background:'rgba(88,166,255,0.07)',borderBottom:`1px solid ${t.border}`,display:'flex',alignItems:'center',gap:6 }}>
        <span style={{ fontSize:11,color:t.muted }}>Контекст:</span>
        <span style={{ fontSize:11,color:t.accent }}>📄 {currentFile}</span>
        <span style={{ fontSize:11,color:t.muted,marginLeft:'auto' }}>📸 📎 поддерживаются</span>
      </div>

      <div style={{ flex:1,overflow:'auto',padding:16,display:'flex',flexDirection:'column',gap:10 }}>
        {msgs.map((m,i) => (
          <div key={i} style={{ display:'flex',flexDirection:'column',alignItems:m.role==='user'?'flex-end':'flex-start' }}>
            {m.role==='ai' && <span style={{ fontSize:10,color:t.muted,marginBottom:4,marginLeft:4 }}>AI</span>}
            {m.attachments?.filter(a=>a.type==='image').map((a,j) => (
              <img key={j} src={`data:${a.mediaType};base64,${a.data}`} alt={a.name}
                style={{ maxWidth:220,maxHeight:160,borderRadius:10,marginBottom:4,border:`1px solid ${t.border}` }}/>
            ))}
            <div style={{ maxWidth:'88%',padding:'10px 14px',background:m.role==='user'?t.accent:t.bg,border:m.role==='ai'?`1px solid ${t.border}`:'none',borderRadius:m.role==='user'?'16px 16px 4px 16px':'4px 16px 16px 16px',color:m.role==='user'?'white':t.text,fontSize:13,lineHeight:1.65,whiteSpace:'pre-wrap',wordBreak:'break-word' }}>
              {m.role==='ai' ? renderAIMessage(m.text) : m.text}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display:'flex',alignItems:'flex-start' }}>
            <div style={{ padding:'10px 14px',background:t.bg,border:`1px solid ${t.border}`,borderRadius:'4px 16px 16px 16px',display:'flex',gap:4,alignItems:'center' }}>
              {[0,1,2].map(i => <div key={i} style={{ width:7,height:7,borderRadius:'50%',background:t.muted,animation:`bounce 1.2s ${i*0.2}s infinite` }}/>)}
            </div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>

      {attachments.length > 0 && (
        <div style={{ padding:'8px 12px',borderTop:`1px solid ${t.border}`,display:'flex',gap:8,overflowX:'auto' }}>
          {attachments.map((a,i) => (
            <div key={i} style={{ position:'relative',flexShrink:0,border:`1px solid ${t.border}`,borderRadius:8,overflow:'hidden' }}>
              {a.type==='image'
                ? <img src={`data:${a.mediaType};base64,${a.data}`} alt={a.name} style={{ width:60,height:60,objectFit:'cover',display:'block' }}/>
                : <div style={{ width:60,height:60,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',background:t.bg,fontSize:22,gap:2 }}>
                    {getIcon(a.name)}<span style={{ fontSize:8,color:t.muted,textAlign:'center',padding:'0 4px',wordBreak:'break-all' }}>{a.name.substring(0,10)}</span>
                  </div>
              }
              <button onClick={()=>removeAttachment(i)} style={{ position:'absolute',top:2,right:2,width:16,height:16,borderRadius:'50%',background:'rgba(0,0,0,0.7)',border:'none',color:'white',fontSize:10,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }}>✕</button>
            </div>
          ))}
        </div>
      )}

      <div style={{ padding:'8px 12px 0',borderTop:attachments.length?'none':`1px solid ${t.border}` }}>
        <div style={{ display:'flex',gap:6,overflowX:'auto',paddingBottom:6 }}>
          {quick.map(a => <button key={a} onClick={()=>send(a)} style={{ padding:'6px 12px',background:'none',border:`1px solid ${t.border}`,borderRadius:20,color:t.muted,fontSize:11,cursor:'pointer',whiteSpace:'nowrap',flexShrink:0 }}>{a}</button>)}
        </div>
      </div>

      <div style={{ padding:'8px 12px',display:'flex',gap:6,alignItems:'flex-end',paddingBottom:`max(12px, env(safe-area-inset-bottom))` }}>
        <input ref={fileInputRef} type="file" multiple accept="image/*,.js,.jsx,.ts,.tsx,.py,.css,.html,.json,.md,.txt"
          onChange={handleAttach} style={{ display:'none' }}/>
        <button onClick={()=>fileInputRef.current?.click()} title="Прикрепить файл"
          style={{ width:38,height:38,borderRadius:'50%',background:'none',border:`1px solid ${t.border}`,color:t.muted,cursor:'pointer',fontSize:17,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center' }}>📎</button>
        <button onClick={handleScreenshot} title="Скриншот экрана"
          style={{ width:38,height:38,borderRadius:'50%',background:'none',border:`1px solid ${t.border}`,color:t.muted,cursor:'pointer',fontSize:17,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center' }}>📸</button>
        <textarea value={input} onChange={e=>setInput(e.target.value)}
          onKeyDown={e=>{ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); send(); } }}
          placeholder="Спроси что-нибудь..." rows={1}
          style={{ flex:1,padding:'10px 14px',background:t.bg,border:`1px solid ${t.border}`,borderRadius:22,color:t.text,fontSize:14,outline:'none',resize:'none',maxHeight:80,lineHeight:1.4,fontFamily:'inherit' }}/>
        <button onClick={()=>send()} disabled={loading||(!input.trim()&&!attachments.length)}
          style={{ width:42,height:42,borderRadius:'50%',background:(input.trim()||attachments.length)?t.accent:t.border,border:'none',color:'white',cursor:'pointer',fontSize:18,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',transition:'background 0.2s' }}>↑</button>
      </div>
      <style>{`@keyframes bounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-6px)}}`}</style>
    </div>
  );
}

function AutocompleteDropdown({ suggestions, onSelect, position, t }) {
  if (!suggestions.length) return null;
  return (
    <div style={{ position:'absolute',top:position.top,left:position.left,zIndex:100,background:t.surface,border:`1px solid ${t.accent}`,borderRadius:8,boxShadow:'0 8px 24px rgba(0,0,0,0.4)',minWidth:160,overflow:'hidden',animation:'fadeIn 0.1s ease' }}>
      {suggestions.map((s,i) => (
        <div key={s} onMouseDown={e=>{ e.preventDefault(); onSelect(s); }}
          style={{ padding:'7px 12px',fontSize:12,color:t.text,cursor:'pointer',borderBottom:i<suggestions.length-1?`1px solid ${t.border}`:'none',display:'flex',alignItems:'center',gap:8 }}
          onMouseEnter={e=>e.currentTarget.style.background=t.selection}
          onMouseLeave={e=>e.currentTarget.style.background='transparent'}
        >
          <span style={{ color:t.accent,fontSize:10 }}>◆</span><span>{s}</span>
        </div>
      ))}
      <div style={{ padding:'4px 12px',fontSize:10,color:t.muted,borderTop:`1px solid ${t.border}`,background:t.bg }}>Tab — применить</div>
    </div>
  );
}

export default function CodeFlowIDE() {
  const [themeKey, setThemeKey] = useState('dark');
  const t = THEMES[themeKey];
  const [files, setFiles] = useState(SAMPLE_FILES);
  const [fileHandles, setFileHandles] = useState({});
  const [activeFile, setActiveFile] = useState('app.jsx');
  const [openTabs, setOpenTabs] = useState(['app.jsx','main.py']);
  const [code, setCode] = useState(SAMPLE_FILES['app.jsx']);
  const [sidePanel, setSidePanel] = useState(null);
  const [showAI, setShowAI] = useState(false);
  const [showGitHub, setShowGitHub] = useState(false);
  const [showCommit, setShowCommit] = useState(false);
  const [githubConnected, setGithubConnected] = useState(false);
  const [gitBranch, setGitBranch] = useState('main');
  const [gitChanges, setGitChanges] = useState(3);
  const [commits, setCommits] = useState([{ msg:'Initial commit', time:'2ч назад', files:4 }]);
  const [showNewFile, setShowNewFile] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [cursor, setCursor] = useState({ line:1, col:1 });
  const [showTerminal, setShowTerminal] = useState(false);
  const [termLines, setTermLines] = useState(['$ npm start','> codeflow@1.0.0 start','Starting dev server...','✓ Compiled successfully!','Local: http://localhost:3000']);
  const [termIn, setTermIn] = useState('');
  const [savedBadge, setSavedBadge] = useState(false);
  const [unsaved, setUnsaved] = useState({});
  const [suggestions, setSuggestions] = useState([]);
  const [acPos, setAcPos] = useState({ top:0, left:0 });
  const textareaRef = useRef(null);

  const openFile = name => {
    setActiveFile(name); setCode(files[name]);
    setOpenTabs(prev => prev.includes(name)?prev:[...prev,name]);
    setSuggestions([]);
  };

  const closeTab = (e, name) => {
    e.stopPropagation();
    const next = openTabs.filter(x=>x!==name);
    setOpenTabs(next);
    if (activeFile===name) { const f=next[Math.max(0,openTabs.indexOf(name)-1)]; if(f) openFile(f); }
    setSuggestions([]);
  };

  const getCaretPos = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return { top:0, left:0 };
    const val = ta.value.substring(0, ta.selectionStart);
    const lines = val.split('\n');
    const lineH = 20;
    const top = 12 + lines.length * lineH;
    const left = lines[lines.length-1].length * 7.2;
    return { top, left: Math.min(left, 260) };
  }, []);

  const updateCode = val => {
    setCode(val);
    setFiles(prev => ({ ...prev, [activeFile]: val }));
    setUnsaved(prev => ({ ...prev, [activeFile]: true }));
    const ta = textareaRef.current;
    if (ta) {
      const before = val.substring(0, ta.selectionStart);
      const lines = before.split('\n');
      setCursor({ line:lines.length, col:lines[lines.length-1].length+1 });
    }
    const pos = ta?.selectionStart ?? val.length;
    const s = getCompletions(val, pos, activeFile);
    setSuggestions(s);
    if (s.length) setAcPos(getCaretPos());
    else setSuggestions([]);
  };

  const applyCompletion = word => {
    const ta = textareaRef.current;
    if (!ta) return;
    const pos = ta.selectionStart;
    const before = code.substring(0, pos);
    const after = code.substring(pos);
    const wm = before.match(/([a-zA-Z_]\w*)$/);
    if (!wm) return;
    const start = pos - wm[1].length;
    const newCode = code.substring(0,start) + word + after;
    setCode(newCode);
    setFiles(prev=>({...prev,[activeFile]:newCode}));
    setSuggestions([]);
    setTimeout(() => { ta.selectionStart = ta.selectionEnd = start+word.length; ta.focus(); }, 0);
  };

  const saveFile = async () => {
    const newHandle = await saveFileToDisk(code, activeFile, fileHandles[activeFile]);
    if (newHandle && newHandle!==fileHandles[activeFile])
      setFileHandles(prev=>({...prev,[activeFile]:newHandle}));
    setSavedBadge(true);
    setUnsaved(prev=>({...prev,[activeFile]:false}));
    setGitChanges(prev=>prev+1);
    setTimeout(()=>setSavedBadge(false), 1500);
  };

  const handleOpenFile = async () => {
    try {
      const result = await openFileFromDisk();
      if (!result) return;
      const { name, content: fileContent, handle } = result;
      setFiles(prev=>({...prev,[name]:fileContent}));
      if (handle) setFileHandles(prev=>({...prev,[name]:handle}));
      openFile(name);
    } catch(e) {
      console.error('Open file error:', e);
    }
  };

  const createNewFile = () => {
    if (!newFileName.trim()) return;
    const name = newFileName.includes('.')?newFileName:newFileName+'.js';
    setFiles(prev=>({...prev,[name]:`// ${name}\n`}));
    setShowNewFile(false); setNewFileName('');
    openFile(name);
  };

  const handleKeyDown = e => {
    if (e.key==='Escape') { setSuggestions([]); return; }
    if (e.key==='Tab' && suggestions.length) { e.preventDefault(); applyCompletion(suggestions[0]); return; }
    if (e.key==='s' && (e.ctrlKey||e.metaKey)) { e.preventDefault(); saveFile(); return; }
    if (e.key==='Tab') {
      e.preventDefault();
      const s = e.target.selectionStart;
      const val = code.substring(0,s)+'  '+code.substring(e.target.selectionEnd);
      updateCode(val);
      setTimeout(()=>e.target.setSelectionRange(s+2,s+2),0);
      return;
    }
    const pairs = {'(':')','{':'}','[':']','"':'"',"'":"'"};
    if (pairs[e.key] && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      const s=e.target.selectionStart, end=e.target.selectionEnd;
      const sel=code.substring(s,end);
      const val=code.substring(0,s)+e.key+sel+pairs[e.key]+code.substring(end);
      updateCode(val);
      setTimeout(()=>e.target.setSelectionRange(s+1,s+1+sel.length),0);
    }
  };

  return (
    <div style={{ width:'100vw',height:'100vh',background:t.bg,color:t.text,display:'flex',flexDirection:'column',fontFamily:"'SF Mono','Fira Code','Cascadia Code',monospace",overflow:'hidden',position:'relative',paddingTop:'env(safe-area-inset-top)' }}>
      <style>{`
        *{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
        ::-webkit-scrollbar{width:3px;height:3px;}
        ::-webkit-scrollbar-thumb{background:${t.border};border-radius:2px;}
        textarea{resize:none;-webkit-appearance:none;}
        @keyframes slideUp{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes pop{0%{transform:scale(0.8);opacity:0}60%{transform:scale(1.1)}100%{transform:scale(1);opacity:1}}
        .btn-hover:active{opacity:0.7!important;transform:scale(0.96);}
      `}</style>

      {/* Title Bar */}
      <div style={{ height:44,background:t.surface,borderBottom:`1px solid ${t.border}`,display:'flex',alignItems:'center',padding:'0 12px',gap:8,flexShrink:0 }}>
        <div style={{ display:'flex',gap:5 }}>
          {['#ff5f57','#febc2e','#28c840'].map((c,i)=><div key={i} style={{ width:12,height:12,borderRadius:'50%',background:c }}/>)}
        </div>
        <div style={{ display:'flex',gap:4 }}>
          <button onClick={handleOpenFile} title="Открыть файл" style={{ padding:'4px 8px',background:'none',border:`1px solid ${t.border}`,borderRadius:6,color:t.muted,fontSize:10,cursor:'pointer' }}>📂 Открыть</button>
          <button onClick={saveFile} title="Сохранить (Ctrl+S)" style={{ padding:'4px 8px',background:'none',border:`1px solid ${t.border}`,borderRadius:6,color:t.muted,fontSize:10,cursor:'pointer' }}>💾 Сохранить</button>
        </div>
        <div style={{ flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:6 }}>
          <span style={{ fontSize:13,fontWeight:700,color:t.text }}>CodeFlow</span>
          <span style={{ fontSize:11,color:t.border }}>|</span>
          <span style={{ fontSize:11,color:t.muted }}>{activeFile}{unsaved[activeFile]&&<span style={{ color:t.orange }}> ●</span>}</span>
          {savedBadge && <span style={{ fontSize:10,color:t.green,animation:'pop 0.3s ease' }}>✓ Saved</span>}
        </div>
        <button onClick={()=>setShowAI(true)} style={{ padding:'5px 10px',background:'linear-gradient(135deg,#7b68ee,#9b8fff)',border:'none',borderRadius:20,color:'white',fontSize:11,fontWeight:600,cursor:'pointer' }}>🤖 AI</button>
        <button onClick={()=>setThemeKey(k=>k==='dark'?'light':'dark')} style={{ background:'none',border:'none',cursor:'pointer',fontSize:17,padding:4 }}>{themeKey==='dark'?'☀️':'🌙'}</button>
      </div>

      {/* Tabs */}
      <div style={{ height:36,background:t.surface,borderBottom:`1px solid ${t.border}`,display:'flex',alignItems:'stretch',overflowX:'auto',flexShrink:0 }}>
        {openTabs.map(tab => (
          <div key={tab} onClick={()=>openFile(tab)} className="btn-hover"
            style={{ display:'flex',alignItems:'center',gap:5,padding:'0 10px',borderRight:`1px solid ${t.border}`,cursor:'pointer',flexShrink:0,background:tab===activeFile?t.bg:'transparent',borderTop:tab===activeFile?`2px solid ${t.accent}`:'2px solid transparent',minWidth:70 }}>
            <span style={{ fontSize:11 }}>{getIcon(tab)}</span>
            <span style={{ fontSize:11,color:tab===activeFile?t.text:t.muted }}>{tab}</span>
            {unsaved[tab] && <span style={{ fontSize:8,color:t.orange }}>●</span>}
            <button onClick={e=>closeTab(e,tab)} style={{ background:'none',border:'none',color:t.muted,cursor:'pointer',fontSize:12,padding:'0 1px',lineHeight:1 }}>✕</button>
          </div>
        ))}
        <button onClick={()=>{ setSidePanel('files'); setShowNewFile(true); }} style={{ padding:'0 12px',background:'none',border:'none',color:t.muted,cursor:'pointer',fontSize:18,flexShrink:0 }}>+</button>
      </div>

      {/* Main */}
      <div style={{ flex:1,display:'flex',overflow:'hidden' }}>

        {/* Activity bar */}
        <div style={{ width:46,background:t.sidebar,borderRight:`1px solid ${t.border}`,display:'flex',flexDirection:'column',alignItems:'center',padding:'8px 0',gap:6,flexShrink:0 }}>
          {[{id:'files',ico:'📁'},{id:'git',ico:'🌿'},{id:'search',ico:'🔍'},{id:'ext',ico:'🔧'}].map(item => (
            <button key={item.id} onClick={()=>setSidePanel(p=>p===item.id?null:item.id)}
              style={{ width:36,height:36,borderRadius:8,background:'none',border:'none',cursor:'pointer',fontSize:17,display:'flex',alignItems:'center',justifyContent:'center',opacity:sidePanel===item.id?1:0.45,borderLeft:sidePanel===item.id?`2px solid ${t.accent}`:'2px solid transparent',transition:'all 0.15s' }}>
              {item.ico}
            </button>
          ))}
          <div style={{ flex:1 }}/>
          <button onClick={()=>setShowGitHub(true)} style={{ width:36,height:36,borderRadius:8,background:'none',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',opacity:githubConnected?1:0.5 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill={githubConnected?t.green:t.muted}>
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
            </svg>
          </button>
        </div>

        {/* Side panel */}
        {sidePanel && (
          <div style={{ width:200,background:t.sidebar,borderRight:`1px solid ${t.border}`,display:'flex',flexDirection:'column',flexShrink:0,overflow:'hidden',animation:'fadeIn 0.15s ease' }}>
            <div style={{ padding:'8px 12px',borderBottom:`1px solid ${t.border}`,display:'flex',alignItems:'center',justifyContent:'space-between' }}>
              <span style={{ fontSize:10,color:t.muted,fontWeight:700,textTransform:'uppercase',letterSpacing:0.8 }}>
                {sidePanel==='files'?'Файлы':sidePanel==='git'?'Git':sidePanel==='search'?'Поиск':'Расширения'}
              </span>
              <button onClick={()=>setSidePanel(null)} style={{ background:'none',border:'none',color:t.muted,cursor:'pointer',fontSize:14 }}>✕</button>
            </div>
            <div style={{ flex:1,overflow:'auto' }}>
              {sidePanel==='files' && <>
                <div style={{ padding:'8px 10px',display:'flex',gap:4 }}>
                  <button onClick={()=>setShowNewFile(v=>!v)} style={{ flex:1,padding:'5px 8px',background:'none',border:`1px solid ${t.border}`,borderRadius:6,color:t.muted,fontSize:11,cursor:'pointer' }}>+ Новый</button>
                  <button onClick={handleOpenFile} style={{ flex:1,padding:'5px 8px',background:'none',border:`1px solid ${t.border}`,borderRadius:6,color:t.muted,fontSize:11,cursor:'pointer' }}>📂</button>
                </div>
                {showNewFile && (
                  <div style={{ padding:'0 10px 8px' }}>
                    <input autoFocus value={newFileName} onChange={e=>setNewFileName(e.target.value)}
                      onKeyDown={e=>{ if(e.key==='Enter') createNewFile(); if(e.key==='Escape') setShowNewFile(false); }}
                      placeholder="файл.py"
                      style={{ width:'100%',padding:'6px 8px',background:t.bg,border:`1px solid ${t.accent}`,borderRadius:6,color:t.text,fontSize:12,outline:'none' }}/>
                  </div>
                )}
                {Object.keys(files).map(name => (
                  <div key={name} onClick={()=>openFile(name)} className="btn-hover"
                    style={{ display:'flex',alignItems:'center',gap:8,padding:'6px 14px',cursor:'pointer',background:activeFile===name?`${t.accent}22`:'transparent' }}>
                    <span style={{ fontSize:13 }}>{getIcon(name)}</span>
                    <span style={{ fontSize:12,color:activeFile===name?t.text:t.muted,flex:1 }}>{name}</span>
                    {unsaved[name] && <span style={{ fontSize:9,color:t.orange }}>●</span>}
                    {fileHandles[name] && <span style={{ fontSize:9,color:t.green }}>💾</span>}
                  </div>
                ))}
              </>}

              {sidePanel==='git' && (
                <div style={{ padding:12,display:'flex',flexDirection:'column',gap:10 }}>
                  <div style={{ background:t.bg,border:`1px solid ${t.border}`,borderRadius:10,padding:14 }}>
                    <div style={{ display:'flex',alignItems:'center',gap:6,marginBottom:10 }}>
                      <span>🌿</span><span style={{ color:t.text,fontWeight:600,fontSize:13 }}>{gitBranch}</span>
                      {githubConnected && <span style={{ fontSize:10,color:t.green,marginLeft:'auto' }}>● online</span>}
                    </div>
                    {!githubConnected
                      ? <button onClick={()=>setShowGitHub(true)} style={{ width:'100%',padding:8,background:'#238636',border:'none',borderRadius:7,color:'white',fontSize:12,cursor:'pointer',fontWeight:600 }}>Подключить GitHub</button>
                      : <div style={{ display:'flex',flexDirection:'column',gap:6 }}>
                          <button onClick={()=>setShowCommit(true)} style={{ padding:7,background:t.accent,border:'none',borderRadius:7,color:'white',fontSize:12,cursor:'pointer' }}>💾 Commit ({gitChanges})</button>
                          <div style={{ display:'flex',gap:6 }}>
                            <button style={{ flex:1,padding:6,background:'#238636',border:'none',borderRadius:7,color:'white',fontSize:11,cursor:'pointer' }}>↑ Push</button>
                            <button style={{ flex:1,padding:6,background:'none',border:`1px solid ${t.border}`,borderRadius:7,color:t.muted,fontSize:11,cursor:'pointer' }}>↓ Pull</button>
                          </div>
                        </div>
                    }
                  </div>
                  {commits.map((c,i) => (
                    <div key={i} style={{ background:t.bg,border:`1px solid ${t.border}`,borderRadius:8,padding:'8px 12px' }}>
                      <div style={{ fontSize:12,color:t.text,marginBottom:3 }}>{c.msg}</div>
                      <div style={{ fontSize:10,color:t.muted }}>{c.files} файлов · {c.time}</div>
                    </div>
                  ))}
                </div>
              )}

              {sidePanel==='search' && (
                <div style={{ padding:10 }}>
                  <input placeholder="Поиск в файлах..." style={{ width:'100%',padding:'8px 10px',background:t.bg,border:`1px solid ${t.border}`,borderRadius:7,color:t.text,fontSize:12,outline:'none',marginBottom:8 }}/>
                  <p style={{ fontSize:11,color:t.muted }}>Начни вводить для поиска...</p>
                </div>
              )}

              {sidePanel==='ext' && (
                <div style={{ padding:10,display:'flex',flexDirection:'column',gap:8 }}>
                  {[{name:'Prettier',desc:'Форматирование',icon:'✨',on:true},{name:'ESLint',desc:'Линтер JS/TS',icon:'🔍',on:true},{name:'Python',desc:'Подсветка + автодополнение',icon:'🐍',on:true},{name:'GitLens',desc:'Git аннотации',icon:'🔮',on:false}].map(ext => (
                    <div key={ext.name} style={{ background:t.bg,border:`1px solid ${ext.on?t.accent+'44':t.border}`,borderRadius:8,padding:'10px 12px' }}>
                      <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:3 }}>
                        <span>{ext.icon}</span><span style={{ color:t.text,fontSize:12,fontWeight:600 }}>{ext.name}</span>
                        <div style={{ marginLeft:'auto',width:30,height:16,borderRadius:8,background:ext.on?t.accent:t.border,position:'relative' }}>
                          <div style={{ position:'absolute',top:2,left:ext.on?16:2,width:12,height:12,borderRadius:'50%',background:'white',transition:'left 0.2s' }}/>
                        </div>
                      </div>
                      <span style={{ fontSize:10,color:t.muted }}>{ext.desc}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Editor */}
        <div style={{ flex:1,display:'flex',flexDirection:'column',overflow:'hidden',minWidth:0 }}>
          <div style={{ flex:1,display:'flex',overflow:'hidden',position:'relative' }}>
            {/* Line numbers */}
            <div style={{ background:t.bg,padding:'12px 6px 12px 4px',textAlign:'right',fontSize:11,lineHeight:'20px',color:t.lineNum,userSelect:'none',flexShrink:0,minWidth:36,overflow:'hidden' }}>
              {code.split('\n').map((_,i) => (
                <div key={i} style={{ paddingRight:6,color:i+1===cursor.line?t.accent:t.lineNum }}>{i+1}</div>
              ))}
            </div>
            {/* Code area */}
            <div style={{ flex:1,position:'relative',overflow:'auto',minWidth:0 }}>
              <div style={{ position:'absolute',inset:0,padding:'12px 16px 12px 0',fontSize:12,lineHeight:'20px',fontFamily:'inherit',whiteSpace:'pre',color:t.text,pointerEvents:'none',zIndex:1,minWidth:'max-content' }}
                dangerouslySetInnerHTML={{ __html:highlight(code,activeFile,t) }}/>
              <textarea ref={textareaRef} value={code}
                onChange={e=>updateCode(e.target.value)}
                onKeyDown={handleKeyDown}
                onClick={()=>setSuggestions([])}
                spellCheck={false} autoCorrect="off" autoCapitalize="off"
                style={{ position:'absolute',inset:0,padding:'12px 16px 12px 0',fontSize:12,lineHeight:'20px',fontFamily:'inherit',background:'transparent',color:'transparent',caretColor:t.text,border:'none',outline:'none',zIndex:2,width:'100%',whiteSpace:'pre',overflow:'auto',minWidth:'max-content' }}
              />
              <AutocompleteDropdown suggestions={suggestions} onSelect={applyCompletion} position={acPos} t={t}/>
            </div>
          </div>

          {showTerminal && (
            <div style={{ height:180,background:'#010409',borderTop:`1px solid ${t.border}`,display:'flex',flexDirection:'column',animation:'slideUp 0.2s ease' }}>
              <div style={{ padding:'5px 12px',display:'flex',alignItems:'center',gap:8,background:'#0d1117',borderBottom:`1px solid ${t.border}22` }}>
                <span style={{ fontSize:11,color:'#3fb950',fontWeight:700 }}>TERMINAL</span>
                <button onClick={()=>setShowTerminal(false)} style={{ marginLeft:'auto',background:'none',border:'none',color:'#484f58',cursor:'pointer',fontSize:14 }}>✕</button>
              </div>
              <div style={{ flex:1,padding:'8px 12px',overflow:'auto',fontSize:12,lineHeight:1.7 }}>
                {termLines.map((l,i) => <div key={i} style={{ color:l.startsWith('$')||l.startsWith('>')?'#3fb950':'#8b949e',fontFamily:'monospace' }}>{l}</div>)}
                <div style={{ display:'flex',gap:6,alignItems:'center',marginTop:4 }}>
                  <span style={{ color:'#3fb950' }}>$</span>
                  <input value={termIn} onChange={e=>setTermIn(e.target.value)}
                    onKeyDown={e=>{ if(e.key==='Enter'){ setTermLines(prev=>[...prev,`$ ${termIn}`,'command not found: '+termIn.split(' ')[0]]); setTermIn(''); } }}
                    style={{ background:'none',border:'none',color:'#e6edf3',fontSize:12,outline:'none',flex:1,fontFamily:'monospace' }}
                    placeholder="введи команду..."/>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Status Bar */}
      <div style={{ height:26,background:t.accent,display:'flex',alignItems:'center',padding:'0 10px',gap:12,flexShrink:0,overflow:'hidden',paddingBottom:'env(safe-area-inset-bottom)' }}>
        <span style={{ fontSize:11,color:'white',fontWeight:700,flexShrink:0 }}>🌿 {gitBranch}</span>
        {githubConnected && <span style={{ fontSize:10,color:'rgba(255,255,255,0.85)',flexShrink:0 }}>✓ GitHub</span>}
        {gitChanges>0 && <span style={{ fontSize:10,color:'rgba(255,255,255,0.85)',flexShrink:0 }}>⚡ {gitChanges}</span>}
        <div style={{ flex:1 }}/>
        <span style={{ fontSize:10,color:'rgba(255,255,255,0.9)',flexShrink:0 }}>
          {getExt(activeFile)==='py'?'🐍 Python':getExt(activeFile).toUpperCase()}
        </span>
        <button onClick={()=>setShowTerminal(v=>!v)} style={{ background:'none',border:'none',color:'rgba(255,255,255,0.8)',fontSize:10,cursor:'pointer',flexShrink:0 }}>⌘ Terminal</button>
        <span style={{ fontSize:10,color:'rgba(255,255,255,0.65)',flexShrink:0 }}>{cursor.line}:{cursor.col}</span>
      </div>

      {showGitHub && <GitHubModal t={t} onClose={()=>setShowGitHub(false)} onConnect={({branch})=>{ setGithubConnected(true); if(branch) setGitBranch(branch); }}/>}
      {showCommit && <CommitModal t={t} files={files} onClose={()=>setShowCommit(false)} onCommit={(msg,sel)=>{ setCommits(prev=>[{msg,time:'только что',files:sel.length},...prev]); setGitChanges(0); }}/>}
      {showAI && <AIPanel t={t} currentFile={activeFile} currentCode={code} onClose={()=>setShowAI(false)} onInsertCode={(code) => { setCode(code); setFiles(prev=>({...prev,[activeFile]:code})); setUnsaved(prev=>({...prev,[activeFile]:true})); setShowAI(false); }}/>}
    </div>
  );
}
