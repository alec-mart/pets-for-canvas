#!/usr/bin/env python3
"""Strip comments from packaged JS / HTML (CSS + HTML comments). Ships no design notes, names, or dates.
JS: a small tokenizer that respects strings, template literals (with ${} nesting) and regex literals.
Every stripped JS file is `node --check`ed by the build script afterwards."""
import re, sys, pathlib

REGEX_PREV = set("(,=:[!&|?{};+-*%<>~^")
KEYWORDS = ("return", "typeof", "case", "in", "of", "delete", "void", "throw", "instanceof", "do", "else", "yield", "await")

def strip_js(src: str) -> str:
    out, i, n = [], 0, len(src)
    tpl_depth = []          # stack of brace depths for ${ } inside template literals
    def prev_sig():
        j = len(out) - 1
        while j >= 0 and out[j] in " \t\r\n": j -= 1
        return j
    while i < n:
        c = src[i]; c2 = src[i:i+2]
        if c2 == "//":
            while i < n and src[i] != "\n": i += 1
            continue
        if c2 == "/*":
            k = src.find("*/", i + 2); i = n if k < 0 else k + 2
            continue
        if c in "'\"":
            q = c; out.append(c); i += 1
            while i < n and src[i] != q:
                if src[i] == "\\": out.append(src[i:i+2]); i += 2; continue
                out.append(src[i]); i += 1
            out.append(q); i += 1; continue
        if c == "`":
            out.append(c); i += 1
            while i < n:
                if src[i] == "\\": out.append(src[i:i+2]); i += 2; continue
                if src[i] == "`": out.append("`"); i += 1; break
                if src[i:i+2] == "${":
                    out.append("${"); i += 2; depth = 1
                    # expression inside: recurse on a slice until the matching }
                    start = i
                    while i < n and depth:
                        ch = src[i]
                        if ch in "'\"`":   # skip nested strings/templates crudely but correctly for balance
                            q = ch; i += 1
                            while i < n and src[i] != q:
                                if src[i] == "\\": i += 2; continue
                                i += 1
                            i += 1; continue
                        if ch == "{": depth += 1
                        elif ch == "}": depth -= 1
                        i += 1
                    out.append(strip_js(src[start:i-1])); out.append("}")
                    continue
                out.append(src[i]); i += 1
            continue
        if c == "/":
            j = prev_sig()
            prev = out[j] if j >= 0 else ""
            word = ""
            k = j
            while k >= 0 and (out[k].isalnum() or out[k] == "_"): word = out[k] + word; k -= 1
            is_regex = j < 0 or prev in REGEX_PREV or word in KEYWORDS
            if is_regex:
                out.append(c); i += 1; in_class = False
                while i < n:
                    ch = src[i]
                    if ch == "\\": out.append(src[i:i+2]); i += 2; continue
                    if ch == "[": in_class = True
                    elif ch == "]": in_class = False
                    elif ch == "/" and not in_class: out.append(ch); i += 1; break
                    elif ch == "\n": break
                    out.append(ch); i += 1
                continue
        out.append(c); i += 1
    s = "".join(out)
    s = re.sub(r"`[^`]*`", lambda m: re.sub(r"/\*[\s\S]*?\*/", "", m.group(0)) if "*/" in m.group(0) else m.group(0), s)
    s = re.sub(r"[ \t]+\n", "\n", s)
    s = re.sub(r"\n{3,}", "\n\n", s)
    return s

def strip_html(src: str) -> str:
    src = re.sub(r"<!--[\s\S]*?-->", "", src)
    def css(m): return m.group(1) + re.sub(r"/\*[\s\S]*?\*/", "", m.group(2)) + m.group(3)
    src = re.sub(r"(<style[^>]*>)([\s\S]*?)(</style>)", css, src)
    src = re.sub(r"[ \t]+\n", "\n", src); src = re.sub(r"\n{3,}", "\n\n", src)
    return src

if __name__ == "__main__":
    for f in sys.argv[1:]:
        p = pathlib.Path(f); s = p.read_text()
        p.write_text(strip_js(s) if p.suffix == ".js" else strip_html(s))
