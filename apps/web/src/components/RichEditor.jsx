import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";

// A small rich-text editor on top of the browser's own editing (contentEditable). Bold, lists, links, colours, images.
// It is uncontrolled: it starts from `html` once, and tells the page about every change. Use ref.setHtml() to replace the content.
const run = (cmd, value) => document.execCommand(cmd, false, value);
const COLORS = ["#251c44", "#c2345c", "#d9731a", "#1d8659", "#2f78d6", "#7447e6", "#6f6590"];
const SAFE_URL = /^(https?:\/\/|mailto:|tel:)/i;
const IMG = /^image\/(png|jpe?g|gif|webp)$/i;

// pasted web pages can carry scripts and event handlers; keep only plain structure
function cleanPasted(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script,style,iframe,object,embed,link,meta,form,input,button,svg,img[src^='data:']").forEach((n) => n.remove());
  doc.querySelectorAll("*").forEach((el) => {
    for (const a of [...el.attributes]) {
      if (/^on/i.test(a.name) || (["href", "src"].includes(a.name) && /^\s*(javascript|data):/i.test(a.value)) || a.name === "class" || a.name === "id") el.removeAttribute(a.name);
    }
  });
  return doc.body.innerHTML;
}

function Btn({ onRun, title, disabled, children }) {
  return (
    <button type="button" className="ghost rt-btn" title={title} aria-label={title} disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={onRun}>{children}</button>
  );
}

const RichEditor = forwardRef(function RichEditor({ html, onChange, onImage, onError, disabled }, ref) {
  const box = useRef(null);
  const fileIn = useRef(null);
  const init = useRef(false);
  const lastRange = useRef(null); // the last selection made inside the editor

  // Clicking a toolbar button can move the selection out of the text. Remember where it was and put it back before a command runs.
  useEffect(() => {
    const keep = () => {
      const sel = window.getSelection();
      if (sel.rangeCount && box.current?.contains(sel.anchorNode) && box.current.contains(sel.focusNode)) lastRange.current = sel.getRangeAt(0).cloneRange();
    };
    document.addEventListener("selectionchange", keep);
    return () => document.removeEventListener("selectionchange", keep);
  }, []);
  const restore = () => {
    box.current.focus();
    const sel = window.getSelection();
    const inside = sel.rangeCount && box.current.contains(sel.anchorNode) && box.current.contains(sel.focusNode);
    if (!inside && lastRange.current) { sel.removeAllRanges(); sel.addRange(lastRange.current); }
  };

  const emit = useCallback(() => onChange?.(box.current.innerHTML), [onChange]);
  const setBox = useCallback((node) => {
    box.current = node;
    if (node && !init.current) { node.innerHTML = html || ""; init.current = true; }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useImperativeHandle(ref, () => ({
    getHtml: () => box.current?.innerHTML ?? "",
    setHtml: (h) => { box.current.innerHTML = h; emit(); },
  }), [emit]);

  const cmd = (c, v) => { restore(); run("styleWithCSS", true); run(c, v); emit(); };
  const link = () => {
    const sel = lastRange.current?.toString() ?? "";
    if (!sel) return onError?.("Select the words you want to turn into a link first.");
    const url = window.prompt("Link address (https://…)", "https://");
    if (!url) return;
    if (!SAFE_URL.test(url.trim())) return onError?.("A link must start with https://, mailto: or tel:");
    cmd("createLink", url.trim());
  };

  const addImages = async (files) => {
    for (const f of files) {
      if (!IMG.test(f.type)) { onError?.("Only PNG, JPG, GIF or WebP images can go inside the email. Use “Attach files” for other files."); continue; }
      try {
        const url = await onImage(f);
        restore();
        run("insertHTML", `<img src="${url}" alt="${f.name.replace(/[<>"&]/g, "")}" style="max-width:100%">`);
        emit();
      } catch (e) { onError?.(e.message); }
    }
  };

  const onPaste = (e) => {
    const files = [...(e.clipboardData?.files || [])].filter((f) => f.type.startsWith("image/"));
    if (files.length) { e.preventDefault(); addImages(files); return; }
    const h = e.clipboardData?.getData("text/html");
    if (h) { e.preventDefault(); run("insertHTML", cleanPasted(h)); emit(); }
  };
  const onDrop = (e) => {
    const files = [...(e.dataTransfer?.files || [])].filter((f) => f.type.startsWith("image/"));
    if (files.length) { e.preventDefault(); addImages(files); }
  };

  const B = ({ c, v, title, children }) => <Btn title={title} disabled={disabled} onRun={() => cmd(c, v)}>{children}</Btn>;

  return (
    <div className={"rte" + (disabled ? " disabled" : "")}>
      <div className="rte-bar" role="toolbar" aria-label="Formatting">
        <select aria-label="Text style" value="p" disabled={disabled} onChange={(e) => cmd("formatBlock", e.target.value)}>
          <option value="p">Normal</option><option value="h1">Heading</option><option value="h2">Subheading</option><option value="blockquote">Quote</option><option value="pre">Code</option>
        </select>
        <B c="bold" title="Bold (Ctrl+B)"><b>B</b></B>
        <B c="italic" title="Italic (Ctrl+I)"><i>I</i></B>
        <B c="underline" title="Underline (Ctrl+U)"><u>U</u></B>
        <B c="strikeThrough" title="Strikethrough"><s>S</s></B>
        <span className="rte-sep" />
        <B c="insertUnorderedList" title="Bullet list">• List</B>
        <B c="insertOrderedList" title="Numbered list">1. List</B>
        <B c="justifyLeft" title="Align left">⇤</B>
        <B c="justifyCenter" title="Center">↔</B>
        <B c="justifyRight" title="Align right">⇥</B>
        <span className="rte-sep" />
        <span className="rte-colors">
          {COLORS.map((c) => (
            <button key={c} type="button" className="rte-dot" style={{ background: c }} title="Text colour" aria-label={`Text colour ${c}`} disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={() => cmd("foreColor", c)} />
          ))}
        </span>
        <B c="hiliteColor" v="#fff2a8" title="Highlight">🖍</B>
        <span className="rte-sep" />
        <Btn title="Add a link to the selected words" disabled={disabled} onRun={link}>🔗 Link</Btn>
        <Btn title="Insert an image into the email" disabled={disabled} onRun={() => fileIn.current.click()}>🖼 Image</Btn>
        <B c="removeFormat" title="Clear formatting">⌫ Clear</B>
        <B c="undo" title="Undo">↶</B>
        <B c="redo" title="Redo">↷</B>
        <input ref={fileIn} type="file" accept="image/png,image/jpeg,image/gif,image/webp" multiple hidden onChange={(e) => { addImages([...e.target.files]); e.target.value = ""; }} />
      </div>
      <div ref={setBox} className="rte-body" contentEditable={!disabled} suppressContentEditableWarning role="textbox" aria-multiline="true" aria-label="Email body" data-placeholder="Write your email…"
        onInput={emit} onPaste={onPaste} onDrop={onDrop} />
    </div>
  );
});

export default RichEditor;
