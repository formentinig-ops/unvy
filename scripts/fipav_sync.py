#!/usr/bin/env python3
"""Legge calendario, risultati e classifica dal portale FIPAV Emilia-Romagna
e scrive data/fipav.json per l'app UNVY.

Uso: python3 scripts/fipav_sync.py [file_html_locale]
Senza argomenti scarica la pagina dal portale.
"""
import datetime as dt
import hashlib
import html
import json
import os
import re
import sys
import urllib.request
from zoneinfo import ZoneInfo

URL = ("https://crer.portalefipav.net/risultati-classifiche.aspx?"
       "ComitatoId=35&StId=2415&DataDa=&StatoGara=&CId=92487&SId=&PId=29422&btFiltro=CERCA")
SQUADRA = "UNIVOLLEY CARPI MO"
CAMPIONATO = "Serie C maschile · Girone A"
OUT = os.path.join(os.path.dirname(__file__), "..", "data", "fipav.json")

FIX = {
    "POL. Audax Parma": "Pol. Audax Parma",
    "AMA Volley Ball SAN Martino": "AMA Volley Ball San Martino",
    "Asd Pallavolo Gallonese": "ASD Pallavolo Gallonese",
    "GS VVF M.MARCONI": "GS VVF M. Marconi",
    "Polisportiva Modena EST": "Polisportiva Modena Est",
    "Mondial Wi-en": "Mondial Wi-En",
}


def nice(name):
    """'UNIVOLLEY CARPI MO' -> 'Univolley Carpi' (toglie la provincia)."""
    w = name.split()
    prov = w[-1] if len(w[-1]) == 2 and w[-1].isupper() else ""
    base = " ".join(w[:-1]) if prov else name
    out = " ".join(
        x if re.fullmatch(r"[A-Z]{1,3}\.?|\d+|[A-Z]\.[A-Z]+", x) and x != "ASD" else x.capitalize()
        for x in base.split()
    )
    return FIX.get(out, out)


def addr_fmt(a):
    for p in ("Mo", "Re", "Pr", "Pc", "Bo", "Fe", "Ra", "Fc", "Rn"):
        a = re.sub(r"\b%s$" % p, p.upper(), a)
    return a


def gym_id(nome):
    return "f" + hashlib.md5(nome.encode()).hexdigest()[:6]


def fetch():
    req = urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0 (UNVY team app)"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read().decode("utf-8", "replace")


def parse(s):
    rows = re.findall(
        r'<tr[^>]*>\s*<td style="text-align:center">(\d+)</td>\s*<td style="text-align:center">(\d+)</td>\s*'
        r'<td style="text-align:center">([^<]*)</td>\s*<td[^>]*>(?:<img[^>]*>)?([^<]*)</td>\s*'
        r'<td[^>]*>(?:<img[^>]*>)?([^<]*)</td>\s*<td[^>]*class="risultato"[^>]*>([^<]*)</td>\s*'
        r'<td[^>]*>(.*?)</td>(.*?)</tr>', s, re.S)
    gare = []
    for n, g, dtime, casa, osp, ris, parz, rest in rows:
        info = re.search(r'info_16\.png"[^>]*title="(.*?)"', rest, re.S)
        v = html.unescape(info.group(1)) if info else ""
        vm = re.search(r"<b>(.*?)</b><br />\s*(.*?)<br />(.*?)</p>", v, re.S)
        gym, city, addr = (x.strip() for x in vm.groups()) if vm else ("", "", "")
        d, t = (dtime.strip().split(" ") + [""])[:2]
        dd, mm, yy = d.split("/") if d else ("", "", "")
        ris = html.unescape(ris).strip()
        gare.append(dict(
            n=int(n), g=int(g), d=f"20{yy}-{mm}-{dd}" if d else "", ora=t,
            casa=casa.strip(), osp=osp.strip(),
            ris="" if ris in ("-", "") else ris.replace(" ", ""),
            parz=" ".join(re.sub(r"<[^>]+>", " ", html.unescape(parz)).split()),
            gym=gym.title(), addr=addr_fmt((addr.title() + ", " + city.title()).strip(", ")),
        ))
    cl = []
    for m in re.finditer(r"<tr[^>]*>\s*<td[^>]*>(\d+)</td>\s*<td[^>]*>(?:<[^>]+>)*([A-Z][^<]*?)(?:</[^>]+>)*</td>"
                         r"((?:\s*<td[^>]*>[^<]*</td>){11})", s):
        nums = re.findall(r"<td[^>]*>([^<]*)</td>", m.group(3))
        cl.append(dict(pos=int(m.group(1)), sq=nice(m.group(2).strip()), pt=int(nums[0]), pg=int(nums[1]),
                       pv=int(nums[2]), pp=int(nums[3]), sf=int(nums[4]), ss=int(nums[5])))
    return gare, cl


def build(gare, cl):
    gyms, nostre, home = {}, [], None
    for g in gare:
        if SQUADRA not in (g["casa"], g["osp"]):
            continue
        gid = gym_id(g["gym"])
        gyms.setdefault(gid, {"id": gid, "nome": g["gym"], "addr": g["addr"]})
        casa = g["casa"] == SQUADRA
        if casa and home is None:
            home = gid
        nostre.append(dict(id="fip%d" % g["n"], n=g["n"], g=g["g"], avv=nice(g["osp"] if casa else g["casa"]),
                           casa=casa, gym=gid, d=g["d"], ora=g["ora"], ris=g["ris"], parz=g["parz"], fip=1))
    tutte = [[g["g"], g["d"], g["ora"], nice(g["casa"]), nice(g["osp"]), g["ris"], g["parz"]] for g in gare]
    # la palestra di casa va per prima: è anche quella degli allenamenti
    ordered = sorted(gyms.values(), key=lambda x: x["id"] != home)
    return dict(camp=CAMPIONATO, home=home, gyms=ordered, gare=nostre, cl=cl, all=tutte)


def main():
    s = open(sys.argv[1], encoding="utf-8", errors="replace").read() if len(sys.argv) > 1 else fetch()
    gare, cl = parse(s)
    if len(gare) < 50 or len(cl) < 6:
        sys.exit("Pagina FIPAV non riconosciuta: %d gare, %d squadre. Non aggiorno." % (len(gare), len(cl)))
    data = build(gare, cl)
    old = None
    if os.path.exists(OUT):
        with open(OUT, encoding="utf-8") as f:
            old = json.load(f)
    if old and {k: v for k, v in old.items() if k != "agg"} == data:
        print("Nessuna novità.")
        return
    now = dt.datetime.now(ZoneInfo("Europe/Rome"))
    mesi = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"]
    data = {"agg": f"{now.day} {mesi[now.month - 1]} {now.year}, {now:%H:%M}", **data}
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    print("Aggiornato: %d gare totali, %d nostre." % (len(gare), len(data["gare"])))


if __name__ == "__main__":
    main()
