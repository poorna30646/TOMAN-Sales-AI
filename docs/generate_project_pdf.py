from html import escape
from pathlib import Path
import re

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "docs" / "TOMAN_Project_Documentation.md"
OUTPUT = ROOT / "TOMAN_Sales_AI_Project_Documentation.pdf"

NAVY = colors.HexColor("#10162F")
VIOLET = colors.HexColor("#635BFF")
INK = colors.HexColor("#1A2340")
MUTED = colors.HexColor("#63708E")
LINE = colors.HexColor("#DCE2F0")
PALE = colors.HexColor("#F5F7FC")


def make_styles():
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle("title", parent=base["Title"], fontName="Helvetica-Bold", fontSize=25, leading=30, textColor=colors.white, spaceAfter=6),
        "subtitle": ParagraphStyle("subtitle", parent=base["Normal"], fontName="Helvetica", fontSize=10.5, leading=15, textColor=colors.HexColor("#DCE0FF")),
        "h1": ParagraphStyle("h1", parent=base["Heading1"], fontName="Helvetica-Bold", fontSize=17, leading=22, textColor=NAVY, spaceBefore=13, spaceAfter=8),
        "h2": ParagraphStyle("h2", parent=base["Heading2"], fontName="Helvetica-Bold", fontSize=12, leading=16, textColor=VIOLET, spaceBefore=10, spaceAfter=5),
        "body": ParagraphStyle("body", parent=base["BodyText"], fontName="Helvetica", fontSize=9.1, leading=13.5, textColor=INK, spaceAfter=5),
        "small": ParagraphStyle("small", parent=base["BodyText"], fontName="Helvetica", fontSize=7.6, leading=10.2, textColor=INK),
        "code": ParagraphStyle("code", parent=base["Code"], fontName="Courier", fontSize=7.7, leading=10.3, textColor=INK, backColor=PALE, borderColor=LINE, borderWidth=0.4, borderPadding=5, spaceAfter=5),
        "bullet": ParagraphStyle("bullet", parent=base["BodyText"], fontName="Helvetica", fontSize=9.0, leading=13, textColor=INK, leftIndent=13, firstLineIndent=-8, spaceAfter=2),
    }


STYLES = make_styles()


def inline(text):
    clean = escape(text)
    clean = re.sub(r"`([^`]+)`", r'<font name="Courier">\1</font>', clean)
    clean = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", clean)
    return clean


def paragraph(text, kind="body"):
    return Paragraph(inline(text), STYLES[kind])


def make_table(lines, width):
    rows = []
    for line in lines:
        if re.match(r"^\|[\s|:-]+\|$", line):
            continue
        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        rows.append(cells)
    if not rows:
        return None
    count = max(len(row) for row in rows)
    normalized = [row + [""] * (count - len(row)) for row in rows]
    col_widths = [width / count] * count
    data = [[paragraph(cell, "small") for cell in row] for row in normalized]
    table = Table(data, colWidths=col_widths, repeatRows=1, hAlign="LEFT")
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), 0.35, LINE),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, PALE]),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    return table


def header_footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.5)
    canvas.line(18 * mm, 14 * mm, A4[0] - 18 * mm, 14 * mm)
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(MUTED)
    canvas.drawString(18 * mm, 8.5 * mm, "TOMAN Sales AI - Project Documentation")
    canvas.drawRightString(A4[0] - 18 * mm, 8.5 * mm, f"Page {doc.page}")
    canvas.restoreState()


def cover():
    content = [
        Paragraph("TOMAN SALES AI", ParagraphStyle("cover_label", fontName="Helvetica-Bold", fontSize=9, leading=12, textColor=colors.HexColor("#C8C5FF"))),
        Paragraph("Project Documentation", STYLES["title"]),
        Paragraph("Mobile application, microservice backend, APIs, databases, security, provider boundaries, and offline demo workflow.", STYLES["subtitle"]),
    ]
    table = Table([[content]], colWidths=[174 * mm])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), NAVY),
        ("LEFTPADDING", (0, 0), (-1, -1), 20),
        ("RIGHTPADDING", (0, 0), (-1, -1), 20),
        ("TOPPADDING", (0, 0), (-1, -1), 44),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 42),
    ]))
    return table


def build():
    doc = SimpleDocTemplate(
        str(OUTPUT), pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm,
        topMargin=16 * mm, bottomMargin=20 * mm, title="TOMAN Sales AI - Project Documentation",
    )
    story = [Spacer(1, 39 * mm), cover(), Spacer(1, 12 * mm)]
    story.extend([
        paragraph("Submission overview", "h2"),
        paragraph("TOMAN is an owner-controlled AI sales workspace. Jarvis helps a business move faster while an owner keeps control of every consequential external action."),
        paragraph("Included: React Native CLI mobile application, Spring Boot microservice backend, MariaDB/MySQL schemas, Gateway API inventory, provider boundaries, and local recording demo."),
        PageBreak(),
    ])

    lines = SOURCE.read_text(encoding="utf-8").splitlines()
    available_width = A4[0] - 36 * mm
    index = 0
    in_code = False
    code_lines = []
    while index < len(lines):
        raw = lines[index]
        stripped = raw.strip()
        if stripped.startswith("```"):
            if in_code:
                story.append(Paragraph("<br/>".join(escape(item) for item in code_lines), STYLES["code"]))
                code_lines = []
            in_code = not in_code
            index += 1
            continue
        if in_code:
            code_lines.append(raw)
            index += 1
            continue
        if not stripped:
            index += 1
            continue
        if stripped.startswith("# "):
            index += 1
            continue
        if stripped.startswith("## "):
            story.append(paragraph(stripped[3:], "h1"))
            index += 1
            continue
        if stripped.startswith("### "):
            story.append(paragraph(stripped[4:], "h2"))
            index += 1
            continue
        if stripped.startswith("|"):
            table_lines = []
            while index < len(lines) and lines[index].strip().startswith("|"):
                table_lines.append(lines[index].strip())
                index += 1
            table = make_table(table_lines, available_width)
            if table:
                story.extend([table, Spacer(1, 5)])
            continue
        if stripped.startswith("- "):
            story.append(paragraph("- " + stripped[2:], "bullet"))
            index += 1
            continue
        if re.match(r"^\d+\. ", stripped):
            story.append(paragraph(stripped, "bullet"))
            index += 1
            continue
        story.append(paragraph(stripped))
        index += 1

    doc.build(story, onFirstPage=header_footer, onLaterPages=header_footer)
    print(OUTPUT)


if __name__ == "__main__":
    build()
