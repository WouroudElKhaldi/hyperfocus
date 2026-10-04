import { type ClipboardEvent, type DragEvent, type ReactNode, forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";
import i18next from "i18next";
import { useTranslation } from "react-i18next";
import { errorOf } from "../../../api.ts";

// A small rich-text editor on top of the browser's own editing (contentEditable). Bold, lists, links, colours, images.
// It is uncontrolled: it starts from `html` once, and tells the page about every change. Use ref.setHtml() to replace the content.
const run = (cmd: string, value?: string) => document.execCommand(cmd, false, value);
const COLORS = ["#251c44", "#c2345c", "#d9731a", "#1d8659", "#2f78d6", "#7447e6", "#6f6590"];
const SAFE_URL = /^(https?:\/\/|mailto:|tel:)/i;
const IMG = /^image\/(png|jpe?g|gif|webp)$/i;

// pasted web pages can carry scripts and event handlers; keep only plain structure
function cleanPasted(html: string) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script,style,iframe,object,embed,link,meta,form,input,button,svg,img[src^='data:']").forEach((n) => n.remove());
  doc.querySelectorAll("*").forEach((el) => {
    for (const a of [...el.attributes]) {
      if (/^on/i.test(a.name) || (["href", "src"].includes(a.name) && /^\s*(javascript|data):/i.test(a.value)) || a.name === "class" || a.name === "id") el.removeAttribute(a.name);
    }
  });
  return doc.body.innerHTML;
}

function Btn({ onRun, title, disabled, children }: { onRun: () => void; title: string; disabled: boolean | undefined; children: ReactNode }) {
  return (
    <button type="button" className="ghost rt-btn" title={title} aria-label={title} disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={onRun}>{children}</button>
  );
}

/** What the page can do with the editor through its ref. */
export type RichEditorHandle = { getHtml: () => string; setHtml: (h: string) => void };
type Props = {
  html: string;
  onChange?: (html: string) => void;
  /** Uploads an image and returns the address to show it from. */
  onImage: (file: File) => Promise<string>;
  onError?: (message: string) => void;
  disabled?: boolean;
};

const RichEditor = forwardRef<RichEditorHandle, Props>(function RichEditor({ html, onChange, onImage, onError, disabled }, ref) {
  const { t } = useTranslation();
  const box = useRef<HTMLDivElement | null>(null);
  const fileIn = useRef<HTMLInputElement>(null);
  const init = useRef(false);
  const lastRange = useRef<Range | null>(null); // the last selection made inside the editor

  // Clicking a toolbar button can move the selection out of the text. Remember where it was and put it back before a command runs.
  useEffect(() => {
    const keep = () => {
      const sel = window.getSelection();
      if (sel?.rangeCount && box.current?.contains(sel.anchorNode) && box.current.contains(sel.focusNode)) lastRange.current = sel.getRangeAt(0).cloneRange();
    };
    document.addEventListener("selectionchange", keep);
    return () => document.removeEventListener("selectionchange", keep);
  }, []);
  const restore = () => {
    box.current?.focus();
    const sel = window.getSelection();
    const inside = sel?.rangeCount && box.current?.contains(sel.anchorNode) && box.current.contains(sel.focusNode);
    if (!inside && lastRange.current) { sel?.removeAllRanges(); sel?.addRange(lastRange.current); }
  };

  const emit = useCallback(() => onChange?.(box.current?.innerHTML ?? ""), [onChange]);
  const setBox = useCallback((node: HTMLDivElement | null) => {
    box.current = node;
    if (node && !init.current) { node.innerHTML = html || ""; init.current = true; }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useImperativeHandle(ref, () => ({
    getHtml: () => box.current?.innerHTML ?? "",
    setHtml: (h) => { if (box.current) box.current.innerHTML = h; emit(); },
  }), [emit]);

  const cmd = (c: string, v?: string) => { restore(); run("styleWithCSS", "true"); run(c, v); emit(); };
  const link = () => {
    const sel = lastRange.current?.toString() ?? "";
    if (!sel) return onError?.(i18next.t("email.selectFirst"));
    const url = window.prompt(i18next.t("email.linkAddress"), "https://");
    if (!url) return;
    if (!SAFE_URL.test(url.trim())) return onError?.(i18next.t("email.linkRule"));
    cmd("createLink", url.trim());
  };

  const addImages = async (files: File[]) => {
    for (const f of files) {
      if (!IMG.test(f.type)) { onError?.(i18next.t("email.imagesOnly")); continue; }
      try {
        const url = await onImage(f);
        restore();
        run("insertHTML", `<img src="${url}" alt="${f.name.replace(/[<>"&]/g, "")}" style="max-width:100%">`);
        emit();
      } catch (caught) { const e = errorOf(caught); onError?.(e.message); }
    }
  };

  const onPaste = (e: ClipboardEvent) => {
    const files = [...(e.clipboardData?.files || [])].filter((f) => f.type.startsWith("image/"));
    if (files.length) { e.preventDefault(); addImages(files); return; }
    const h = e.clipboardData?.getData("text/html");
    if (h) { e.preventDefault(); run("insertHTML", cleanPasted(h)); emit(); }
  };
  const onDrop = (e: DragEvent) => {
    const files = [...(e.dataTransfer?.files || [])].filter((f) => f.type.startsWith("image/"));
    if (files.length) { e.preventDefault(); addImages(files); }
  };

  const B = ({ c, v, title, children }: { c: string; v?: string; title: string; children: ReactNode }) => <Btn title={title} disabled={disabled} onRun={() => cmd(c, v)}>{children}</Btn>;

  return (
    <div className={"rte" + (disabled ? " disabled" : "")}>
      <div className="rte-bar" role="toolbar" aria-label={t("email.formatting")}>
        <select aria-label={t("email.textStyle")} value="p" disabled={disabled} onChange={(e) => cmd("formatBlock", e.target.value)}>
          <option value="p">{t("email.normal")}</option><option value="h1">{t("email.heading")}</option><option value="h2">{t("email.subheading")}</option><option value="blockquote">{t("email.quote")}</option><option value="pre">{t("email.code")}</option>
        </select>
        <B c="bold" title={t("email.bold")}><b>B</b></B>
        <B c="italic" title={t("email.italic")}><i>I</i></B>
        <B c="underline" title={t("email.underline")}><u>U</u></B>
        <B c="strikeThrough" title={t("email.strike")}><s>S</s></B>
        <span className="rte-sep" />
        <B c="insertUnorderedList" title={t("email.bullets")}>• {t("email.list")}</B>
        <B c="insertOrderedList" title={t("email.numbered")}>1. {t("email.list")}</B>
        <B c="justifyLeft" title={t("email.left")}>⇤</B>
        <B c="justifyCenter" title={t("email.center")}>↔</B>
        <B c="justifyRight" title={t("email.right")}>⇥</B>
        <span className="rte-sep" />
        <span className="rte-colors">
          {COLORS.map((c) => (
            <button key={c} type="button" className="rte-dot" style={{ background: c }} title={t("email.colour")} aria-label={t("email.colourNamed", { c })} disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={() => cmd("foreColor", c)} />
          ))}
        </span>
        <B c="hiliteColor" v="#fff2a8" title={t("email.highlight")}>🖍</B>
        <span className="rte-sep" />
        <Btn title={t("email.linkHint")} disabled={disabled} onRun={link}>{t("email.link")}</Btn>
        <Btn title={t("email.imageHint")} disabled={disabled} onRun={() => fileIn.current?.click()}>{t("email.image")}</Btn>
        <B c="removeFormat" title={t("email.clearHint")}>{t("email.clear")}</B>
        <B c="undo" title={t("email.undo")}>↶</B>
        <B c="redo" title={t("email.redo")}>↷</B>
        <input ref={fileIn} type="file" accept="image/png,image/jpeg,image/gif,image/webp" multiple hidden onChange={(e) => { addImages([...(e.target.files ?? [])]); e.target.value = ""; }} />
      </div>
      <div ref={setBox} className="rte-body" contentEditable={!disabled} suppressContentEditableWarning role="textbox" aria-multiline="true" aria-label={t("email.body")} data-placeholder={t("email.bodyPlaceholder")}
        onInput={emit} onPaste={onPaste} onDrop={onDrop} />
    </div>
  );
});

export default RichEditor;
