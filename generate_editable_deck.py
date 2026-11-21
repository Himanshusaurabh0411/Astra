import os
import pptx
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE

def build_editable_deck(output_path="d:/Astra/TERRAPULSE_EDITABLE_DECK.pptx"):
    prs = pptx.Presentation()
    # 16:9 widescreen
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    blank_layout = prs.slide_layouts[6]

    # Color Palette from the design
    BG_LIGHT = RGBColor(248, 250, 248)       # Crisp off-white / light mint tint
    DARK_GREEN = RGBColor(20, 83, 45)        # Forest green (#14532D)
    BRAND_GREEN = RGBColor(22, 101, 52)      # Primary green (#166534)
    ACCENT_GREEN = RGBColor(34, 139, 34)     # Accent green (#228B22)
    LIGHT_GREEN = RGBColor(74, 222, 128)     # Mint green highlight
    CARD_BG = RGBColor(255, 255, 255)        # Pure white
    CARD_BORDER = RGBColor(226, 232, 240)    # Slate 200 border
    TEXT_DARK = RGBColor(30, 41, 59)         # Slate 800
    TEXT_MUTED = RGBColor(100, 116, 139)     # Slate 500
    TEXT_WHITE = RGBColor(255, 255, 255)
    ALERT_ORANGE = RGBColor(234, 88, 12)     # Orange 600
    ALERT_RED = RGBColor(220, 38, 38)        # Red 600

    def add_slide_header(slide, cat_text, title_text, sub_text=None):
        # Category
        cat_box = slide.shapes.add_textbox(Inches(0.4), Inches(0.25), Inches(9.0), Inches(0.3))
        tf_c = cat_box.text_frame
        tf_c.word_wrap = True
        tf_c.margin_top = tf_c.margin_bottom = tf_c.margin_left = tf_c.margin_right = 0
        p_c = tf_c.paragraphs[0]
        p_c.text = cat_text
        p_c.font.size = Pt(11)
        p_c.font.bold = True
        p_c.font.color.rgb = BRAND_GREEN
        p_c.font.name = "Segoe UI"

        # Main Title
        title_box = slide.shapes.add_textbox(Inches(0.4), Inches(0.52), Inches(8.5), Inches(0.65))
        tf_t = title_box.text_frame
        tf_t.word_wrap = True
        tf_t.margin_top = tf_t.margin_bottom = tf_t.margin_left = tf_t.margin_right = 0
        p_t = tf_t.paragraphs[0]
        p_t.text = title_text
        p_t.font.size = Pt(28)
        p_t.font.bold = True
        p_t.font.color.rgb = DARK_GREEN
        p_t.font.name = "Segoe UI"

        # Underline accent bar
        line = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.4), Inches(1.18), Inches(0.9), Inches(0.06))
        line.fill.solid()
        line.fill.fore_color.rgb = ACCENT_GREEN
        line.line.fill.background()

        # Subtitle
        if sub_text:
            sub_box = slide.shapes.add_textbox(Inches(1.4), Inches(1.10), Inches(8.0), Inches(0.35))
            tf_s = sub_box.text_frame
            tf_s.word_wrap = True
            tf_s.margin_top = tf_s.margin_bottom = tf_s.margin_left = tf_s.margin_right = 0
            p_s = tf_s.paragraphs[0]
            p_s.text = sub_text
            p_s.font.size = Pt(12)
            p_s.font.color.rgb = TEXT_MUTED
            p_s.font.name = "Segoe UI"

        # Top Right Pill Button: ASTRA Hackathon
        pill = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(10.2), Inches(0.35), Inches(2.6), Inches(0.55))
        pill.fill.solid()
        pill.fill.fore_color.rgb = CARD_BG
        pill.line.color.rgb = BRAND_GREEN
        pill.line.width = Pt(1.5)
        tf_p = pill.text_frame
        tf_p.vertical_anchor = MSO_ANCHOR.MIDDLE
        p_p = tf_p.paragraphs[0]
        p_p.text = "ASTRA Hackathon"
        p_p.font.size = Pt(12)
        p_p.font.bold = True
        p_p.font.color.rgb = DARK_GREEN
        p_p.alignment = PP_ALIGN.CENTER

    def add_footer(slide, page_num):
        # Footer text left
        fb_l = slide.shapes.add_textbox(Inches(0.4), Inches(7.15), Inches(3.0), Inches(0.25))
        tf_l = fb_l.text_frame
        p_l = tf_l.paragraphs[0]
        p_l.text = "Zero Latency"
        p_l.font.size = Pt(9.5)
        p_l.font.color.rgb = TEXT_MUTED

        # Footer page right
        fb_r = slide.shapes.add_textbox(Inches(12.5), Inches(7.15), Inches(0.5), Inches(0.25))
        tf_r = fb_r.text_frame
        p_r = tf_r.paragraphs[0]
        p_r.text = str(page_num)
        p_r.font.size = Pt(9.5)
        p_r.font.color.rgb = TEXT_MUTED
        p_r.alignment = PP_ALIGN.RIGHT

    def add_six_module_grid(slide, modules, x_start=Inches(4.5), y_start=Inches(1.7)):
        w = Inches(2.3)
        h = Inches(1.1)
        gap_x = Inches(0.18)
        gap_y = Inches(0.15)
        for idx, (abbr, title, sub) in enumerate(modules):
            col = idx % 2
            row = idx // 2
            cx = x_start + col * (w + gap_x)
            cy = y_start + row * (h + gap_y)

            # Card shape
            card = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, cx, cy, w, h)
            card.fill.solid()
            card.fill.fore_color.rgb = CARD_BG
            card.line.color.rgb = CARD_BORDER
            card.line.width = Pt(1)

            # Circle badge
            circ = slide.shapes.add_shape(MSO_SHAPE.OVAL, cx + Inches(0.12), cy + Inches(0.28), Inches(0.48), Inches(0.48))
            circ.fill.solid()
            circ.fill.fore_color.rgb = DARK_GREEN if abbr in ["AI", "GR", "PC"] else ACCENT_GREEN
            circ.line.fill.background()
            tf_circ = circ.text_frame
            tf_circ.vertical_anchor = MSO_ANCHOR.MIDDLE
            p_circ = tf_circ.paragraphs[0]
            p_circ.text = abbr
            p_circ.font.size = Pt(10)
            p_circ.font.bold = True
            p_circ.font.color.rgb = TEXT_WHITE
            p_circ.alignment = PP_ALIGN.CENTER

            # Text inside card
            tb = slide.shapes.add_textbox(cx + Inches(0.68), cy + Inches(0.15), w - Inches(0.72), h - Inches(0.25))
            tf = tb.text_frame
            tf.word_wrap = True
            tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
            
            p1 = tf.paragraphs[0]
            p1.text = title
            p1.font.size = Pt(10.5)
            p1.font.bold = True
            p1.font.color.rgb = DARK_GREEN

            p2 = tf.add_paragraph()
            p2.text = sub
            p2.font.size = Pt(8.5)
            p2.font.color.rgb = TEXT_MUTED
            p2.space_before = Pt(3)

    # =========================================================================
    # SLIDE 1: TERRAPULSE (Product Overview)
    # =========================================================================
    s1 = prs.slides.add_slide(blank_layout)
    add_slide_header(s1, "ZERO LATENCY • PRODUCT OVERVIEW", "TERRAPULSE", "AI-powered Earth Intelligence & Disaster Prediction Platform")
    
    # Left Column: Concept & Problem
    left_tb = s1.shapes.add_textbox(Inches(0.4), Inches(1.5), Inches(3.9), Inches(3.8))
    tf_l = left_tb.text_frame
    tf_l.word_wrap = True
    
    p = tf_l.paragraphs[0]
    p.text = "CONCEPT"
    p.font.size = Pt(11)
    p.font.bold = True
    p.font.color.rgb = DARK_GREEN

    p2 = tf_l.add_paragraph()
    p2.text = "Satellite imagery, weather and environmental data + AI to spot threats to farmland, water and infrastructure — early."
    p2.font.size = Pt(10)
    p2.font.color.rgb = TEXT_DARK
    p2.space_before = Pt(4)

    p3 = tf_l.add_paragraph()
    p3.text = "THE PROBLEM"
    p3.font.size = Pt(11)
    p3.font.bold = True
    p3.font.color.rgb = DARK_GREEN
    p3.space_before = Pt(14)

    prob_bullets = [
        "Farmers discover crop stress too late",
        "Flood-prone areas are not always monitored",
        "Water depletion is hard to track continuously",
        "Agencies work with fragmented geo-data",
        "Decision-makers need actionable intelligence, not just images"
    ]
    for b in prob_bullets:
        pb = tf_l.add_paragraph()
        pb.text = f"•  {b}"
        pb.font.size = Pt(9.5)
        pb.font.color.rgb = TEXT_DARK
        pb.space_before = Pt(5)

    # Center Column (6 modules)
    s1_modules = [
        ("AG", "Agriculture\nIntelligence", "Crop stress detection"),
        ("FL", "Flood Intelligence", "Inundation & risk"),
        ("WA", "Water Intelligence", "Water-body change"),
        ("WE", "Weather Intelligence", "Rainfall & cloud"),
        ("IN", "Infrastructure\nIntelligence", "Roads, settlements, assets"),
        ("AI", "AI Recommendation\nEngine", "Location-specific actions")
    ]
    add_six_module_grid(s1, s1_modules, Inches(4.5), Inches(1.65))

    # Right Column: Earth Image & Commercial Box
    if os.path.exists("d:/Astra/slide_assets/s1_earth.png"):
        s1.shapes.add_picture("d:/Astra/slide_assets/s1_earth.png", Inches(9.45), Inches(1.4), width=Inches(3.5))

    comm_box = s1.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(9.45), Inches(3.7), Inches(3.5), Inches(1.5))
    comm_box.fill.solid()
    comm_box.fill.fore_color.rgb = DARK_GREEN
    comm_box.line.fill.background()
    tf_cb = comm_box.text_frame
    tf_cb.word_wrap = True
    tf_cb.margin_left = tf_cb.margin_right = Inches(0.25)
    tf_cb.margin_top = Inches(0.25)
    p_cb1 = tf_cb.paragraphs[0]
    p_cb1.text = "Commercial potential: Very High"
    p_cb1.font.size = Pt(12.5)
    p_cb1.font.bold = True
    p_cb1.font.color.rgb = TEXT_WHITE
    p_cb2 = tf_cb.add_paragraph()
    p_cb2.text = "A subscription-based geospatial intelligence platform."
    p_cb2.font.size = Pt(10)
    p_cb2.font.color.rgb = RGBColor(220, 252, 231)
    p_cb2.space_before = Pt(6)

    # Customers section
    cust_box = s1.shapes.add_textbox(Inches(0.4), Inches(5.35), Inches(12.5), Inches(0.6))
    tf_c = cust_box.text_frame
    tf_c.word_wrap = True
    p_c1 = tf_c.paragraphs[0]
    p_c1.text = "CUSTOMERS"
    p_c1.font.size = Pt(10)
    p_c1.font.bold = True
    p_c1.font.color.rgb = DARK_GREEN
    
    p_c2 = tf_c.add_paragraph()
    p_c2.text = "• Crop insurers    • Disaster management departments    • AgriTech companies    • Agricultural lending banks    • Infrastructure developers    • Large agri businesses"
    p_c2.font.size = Pt(9.5)
    p_c2.font.color.rgb = TEXT_DARK
    p_c2.space_before = Pt(3)

    # How it works flow
    how_label = s1.shapes.add_textbox(Inches(0.4), Inches(6.05), Inches(2.5), Inches(0.25))
    how_label.text_frame.paragraphs[0].text = "HOW IT WORKS"
    how_label.text_frame.paragraphs[0].font.size = Pt(10)
    how_label.text_frame.paragraphs[0].font.bold = True
    how_label.text_frame.paragraphs[0].font.color.rgb = DARK_GREEN

    flow_steps = [
        ("Select District", None, False),
        ("Multi-Portal Data", "Bhoonidhi • Bhuvan • MOSDAC • VEDAS", False),
        ("AI Analysis", None, False),
        ("6 Intelligence Modules", None, False),
        ("Recommended Actions", None, True)
    ]
    flow_x = Inches(0.5)
    step_w = Inches(2.1)
    step_h = Inches(0.8)
    gap = Inches(0.4)
    for i, (title, sub, is_dark) in enumerate(flow_steps):
        fx = flow_x + i * (step_w + gap)
        box = s1.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, fx, Inches(6.32), step_w, step_h)
        box.fill.solid()
        box.fill.fore_color.rgb = DARK_GREEN if is_dark else CARD_BG
        box.line.color.rgb = DARK_GREEN
        box.line.width = Pt(1.5)
        tf_f = box.text_frame
        tf_f.vertical_anchor = MSO_ANCHOR.MIDDLE
        tf_f.word_wrap = True
        p_f = tf_f.paragraphs[0]
        p_f.text = title
        p_f.font.size = Pt(10)
        p_f.font.bold = True
        p_f.font.color.rgb = TEXT_WHITE if is_dark else DARK_GREEN
        p_f.alignment = PP_ALIGN.CENTER
        if sub:
            p_sub = tf_f.add_paragraph()
            p_sub.text = sub
            p_sub.font.size = Pt(7)
            p_sub.font.color.rgb = TEXT_MUTED
            p_sub.alignment = PP_ALIGN.CENTER
        
        # Arrow
        if i < len(flow_steps) - 1:
            arr = s1.shapes.add_shape(MSO_SHAPE.RIGHT_ARROW, fx + step_w + Inches(0.08), Inches(6.62), Inches(0.22), Inches(0.18))
            arr.fill.solid()
            arr.fill.fore_color.rgb = ACCENT_GREEN
            arr.line.fill.background()

    add_footer(s1, 1)

    # =========================================================================
    # SLIDE 2: JALDRISHTI (Water Intelligence)
    # =========================================================================
    s2 = prs.slides.add_slide(blank_layout)
    add_slide_header(s2, "ZERO LATENCY • PRODUCT OVERVIEW", "JALDRISHTI", "India's AI-powered Water Intelligence Network")

    # Left Column
    left_tb = s2.shapes.add_textbox(Inches(0.4), Inches(1.5), Inches(3.9), Inches(3.8))
    tf_l = left_tb.text_frame
    tf_l.word_wrap = True
    
    p = tf_l.paragraphs[0]
    p.text = "CONCEPT"
    p.font.size = Pt(11)
    p.font.bold = True
    p.font.color.rgb = DARK_GREEN

    p2 = tf_l.add_paragraph()
    p2.text = "Satellite-powered monitoring of water availability, water stress and water-management decisions."
    p2.font.size = Pt(10)
    p2.font.color.rgb = TEXT_DARK
    p2.space_before = Pt(4)

    p3 = tf_l.add_paragraph()
    p3.text = "THE PROBLEM"
    p3.font.size = Pt(11)
    p3.font.bold = True
    p3.font.color.rgb = DARK_GREEN
    p3.space_before = Pt(14)

    prob_bullets_s2 = [
        "Reservoirs are declining",
        "Groundwater stress in farm regions",
        "Water bodies shrink over time",
        "Drought affects productivity",
        "No consolidated regional water-planning data"
    ]
    for b in prob_bullets_s2:
        pb = tf_l.add_paragraph()
        pb.text = f"•  {b}"
        pb.font.size = Pt(9.5)
        pb.font.color.rgb = TEXT_DARK
        pb.space_before = Pt(5)

    # Center 6 cards
    s2_modules = [
        ("SA", "Water-body surface-\narea change", "Detected from satellite time series"),
        ("RS", "Reservoir & lake\nconditions", "Continuous monitoring"),
        ("VM", "Vegetation &\nmoisture stress", "Early stress signals"),
        ("RF", "Rainfall pattern\nanalysis", "Seasonal deviation tracking"),
        ("DV", "Drought-vulnerable\nareas", "Risk mapped by region"),
        ("PC", "Priority conservation\nzones", "Where to act first")
    ]
    add_six_module_grid(s2, s2_modules, Inches(4.5), Inches(1.65))

    # Right: lake photo & commercial card
    if os.path.exists("d:/Astra/slide_assets/s2_lake.png"):
        s2.shapes.add_picture("d:/Astra/slide_assets/s2_lake.png", Inches(9.45), Inches(1.4), width=Inches(3.5))

    comm_box2 = s2.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(9.45), Inches(3.7), Inches(3.5), Inches(1.5))
    comm_box2.fill.solid()
    comm_box2.fill.fore_color.rgb = DARK_GREEN
    comm_box2.line.fill.background()
    tf_cb2 = comm_box2.text_frame
    tf_cb2.word_wrap = True
    tf_cb2.margin_left = tf_cb2.margin_right = Inches(0.25)
    tf_cb2.margin_top = Inches(0.25)
    p = tf_cb2.paragraphs[0]
    p.text = "Commercial potential: Very High"
    p.font.size = Pt(12.5)
    p.font.bold = True
    p.font.color.rgb = TEXT_WHITE
    p2 = tf_cb2.add_paragraph()
    p2.text = "Applications extend beyond agriculture."
    p2.font.size = Pt(10)
    p2.font.color.rgb = RGBColor(220, 252, 231)
    p2.space_before = Pt(6)

    # Customers
    cust_box2 = s2.shapes.add_textbox(Inches(0.4), Inches(5.35), Inches(12.5), Inches(0.6))
    tf_c2 = cust_box2.text_frame
    tf_c2.word_wrap = True
    tf_c2.paragraphs[0].text = "CUSTOMERS"
    tf_c2.paragraphs[0].font.size = Pt(10)
    tf_c2.paragraphs[0].font.bold = True
    tf_c2.paragraphs[0].font.color.rgb = DARK_GREEN
    p_c2 = tf_c2.add_paragraph()
    p_c2.text = "• State water-resource departments    • Irrigation departments    • Municipal corporations    • Agricultural companies    • Industrial water managers"
    p_c2.font.size = Pt(9.5)
    p_c2.font.color.rgb = TEXT_DARK
    p_c2.space_before = Pt(3)

    # How it works
    how_label2 = s2.shapes.add_textbox(Inches(0.4), Inches(6.05), Inches(2.5), Inches(0.25))
    how_label2.text_frame.paragraphs[0].text = "HOW IT WORKS"
    how_label2.text_frame.paragraphs[0].font.size = Pt(10)
    how_label2.text_frame.paragraphs[0].font.bold = True
    how_label2.text_frame.paragraphs[0].font.color.rgb = DARK_GREEN

    s2_flow = [
        ("Satellite Imagery", "Bhoonidhi", False),
        ("Water Maps", "Bhuvan", False),
        ("Rainfall", "MOSDAC", False),
        ("Environmental Analysis", "VEDAS", False),
        ("Water Change & Drought\nAnalysis", None, True),
        ("Priority Conservation\nZones", None, False)
    ]
    flow_x = Inches(0.5)
    step_w = Inches(1.8)
    step_h = Inches(0.8)
    gap = Inches(0.28)
    for i, (title, sub, is_dark) in enumerate(s2_flow):
        fx = flow_x + i * (step_w + gap)
        box = s2.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, fx, Inches(6.32), step_w, step_h)
        box.fill.solid()
        box.fill.fore_color.rgb = DARK_GREEN if is_dark else CARD_BG
        box.line.color.rgb = DARK_GREEN
        box.line.width = Pt(1.5)
        tf_f = box.text_frame
        tf_f.vertical_anchor = MSO_ANCHOR.MIDDLE
        tf_f.word_wrap = True
        p_f = tf_f.paragraphs[0]
        p_f.text = title
        p_f.font.size = Pt(9.5)
        p_f.font.bold = True
        p_f.font.color.rgb = TEXT_WHITE if is_dark else DARK_GREEN
        p_f.alignment = PP_ALIGN.CENTER
        if sub:
            p_sub = tf_f.add_paragraph()
            p_sub.text = sub
            p_sub.font.size = Pt(7)
            p_sub.font.color.rgb = TEXT_MUTED
            p_sub.alignment = PP_ALIGN.CENTER
        
        if i < len(s2_flow) - 1:
            arr = s2.shapes.add_shape(MSO_SHAPE.RIGHT_ARROW, fx + step_w + Inches(0.04), Inches(6.62), Inches(0.20), Inches(0.18))
            arr.fill.solid()
            arr.fill.fore_color.rgb = ACCENT_GREEN
            arr.line.fill.background()

    add_footer(s2, 2)

    # =========================================================================
    # SLIDE 3: KRISHISAT (Agricultural Risk)
    # =========================================================================
    s3 = prs.slides.add_slide(blank_layout)
    add_slide_header(s3, "ZERO LATENCY • PRODUCT OVERVIEW", "KRISHISAT", "AI-powered Satellite Agricultural Risk Intelligence")

    # Left Column
    left_tb3 = s3.shapes.add_textbox(Inches(0.4), Inches(1.5), Inches(3.8), Inches(3.8))
    tf_l3 = left_tb3.text_frame
    tf_l3.word_wrap = True
    
    p = tf_l3.paragraphs[0]
    p.text = "THE PROBLEM — FARMERS OFTEN DON'T KNOW:"
    p.font.size = Pt(10.5)
    p.font.bold = True
    p.font.color.rgb = DARK_GREEN

    krishi_probs = [
        "Which field parts are under vegetation stress",
        "Whether rainfall patterns signal crop damage",
        "Whether fields are nearing drought",
        "Whether nearby water resources are declining",
        "Which areas need immediate attention"
    ]
    for b in krishi_probs:
        pb = tf_l3.add_paragraph()
        pb.text = f"•  {b}"
        pb.font.size = Pt(9.5)
        pb.font.color.rgb = TEXT_DARK
        pb.space_before = Pt(6)

    # Center: Large WHAT YOU GET Card
    wyg_card = s3.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(4.3), Inches(1.65), Inches(4.7), Inches(3.5))
    wyg_card.fill.solid()
    wyg_card.fill.fore_color.rgb = CARD_BG
    wyg_card.line.color.rgb = CARD_BORDER
    wyg_card.line.width = Pt(1.5)
    
    tf_wyg = wyg_card.text_frame
    tf_wyg.margin_left = tf_wyg.margin_right = Inches(0.3)
    tf_wyg.margin_top = Inches(0.25)
    tf_wyg.word_wrap = True
    p = tf_wyg.paragraphs[0]
    p.text = "WHAT YOU GET"
    p.font.size = Pt(11)
    p.font.bold = True
    p.font.color.rgb = DARK_GREEN

    p2 = tf_wyg.add_paragraph()
    p2.text = "Enter a village, district or field location and receive:"
    p2.font.size = Pt(9.5)
    p2.font.color.rgb = TEXT_MUTED
    p2.space_before = Pt(2)

    # Two column bullets inside WHAT YOU GET
    col1_tb = s3.shapes.add_textbox(Inches(4.5), Inches(2.4), Inches(2.1), Inches(2.5))
    tf_c1 = col1_tb.text_frame
    tf_c1.word_wrap = True
    bullets_c1 = [
        "Vegetation health",
        "Historical comparison",
        "Rainfall analysis",
        "Water availability\nindicators"
    ]
    for idx, b in enumerate(bullets_c1):
        p_b = tf_c1.paragraphs[0] if idx == 0 else tf_c1.add_paragraph()
        p_b.text = f"•  {b}"
        p_b.font.size = Pt(9.5)
        p_b.font.color.rgb = TEXT_DARK
        p_b.space_before = Pt(6)

    col2_tb = s3.shapes.add_textbox(Inches(6.8), Inches(2.4), Inches(2.1), Inches(2.5))
    tf_c2 = col2_tb.text_frame
    tf_c2.word_wrap = True
    bullets_c2 = [
        "Drought alerts",
        "Crop-stress hotspot maps",
        "Insurer risk reports"
    ]
    for idx, b in enumerate(bullets_c2):
        p_b = tf_c2.paragraphs[0] if idx == 0 else tf_c2.add_paragraph()
        p_b.text = f"•  {b}"
        p_b.font.size = Pt(9.5)
        p_b.font.color.rgb = TEXT_DARK
        p_b.space_before = Pt(6)

    # Right Column: Farm Photo & Risk Score Card
    if os.path.exists("d:/Astra/slide_assets/s3_farm.png"):
        s3.shapes.add_picture("d:/Astra/slide_assets/s3_farm.png", Inches(9.35), Inches(1.4), width=Inches(3.6))

    # Risk Score Card
    risk_card = s3.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(9.35), Inches(3.2), Inches(3.6), Inches(2.1))
    risk_card.fill.solid()
    risk_card.fill.fore_color.rgb = CARD_BG
    risk_card.line.color.rgb = CARD_BORDER
    risk_card.line.width = Pt(1)
    
    tf_rc = risk_card.text_frame
    tf_rc.margin_left = tf_rc.margin_right = Inches(0.2)
    tf_rc.margin_top = Inches(0.15)
    tf_rc.word_wrap = True
    p = tf_rc.paragraphs[0]
    p.text = "Agricultural Risk Score"
    p.font.size = Pt(11)
    p.font.bold = True
    p.font.color.rgb = DARK_GREEN
    
    p2 = tf_rc.add_paragraph()
    p2.text = "Illustrative output, not actual satellite measurements"
    p2.font.size = Pt(7.5)
    p2.font.bold = True
    p2.font.color.rgb = ALERT_ORANGE

    p3 = tf_rc.add_paragraph()
    p3.text = "Vegetation health:                       Moderate"
    p3.font.size = Pt(9)
    p3.font.color.rgb = TEXT_DARK
    p3.space_before = Pt(4)

    p4 = tf_rc.add_paragraph()
    p4.text = "Rainfall deviation:                             High"
    p4.font.size = Pt(9)
    p4.font.color.rgb = ALERT_ORANGE
    p4.space_before = Pt(2)

    p5 = tf_rc.add_paragraph()
    p5.text = "Water availability:                              Low"
    p5.font.size = Pt(9)
    p5.font.color.rgb = ALERT_ORANGE
    p5.space_before = Pt(2)

    p6 = tf_rc.add_paragraph()
    p6.text = "Crop stress:                                  Elevated"
    p6.font.size = Pt(9)
    p6.font.color.rgb = ALERT_ORANGE
    p6.space_before = Pt(2)

    # Overall risk pink pill
    ov_pill = s3.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(9.55), Inches(4.75), Inches(3.2), Inches(0.4))
    ov_pill.fill.solid()
    ov_pill.fill.fore_color.rgb = RGBColor(254, 226, 226) # light red/pink
    ov_pill.line.color.rgb = RGBColor(252, 165, 165)
    tf_ov = ov_pill.text_frame
    tf_ov.vertical_anchor = MSO_ANCHOR.MIDDLE
    p = tf_ov.paragraphs[0]
    p.text = "Overall risk: HIGH"
    p.font.size = Pt(10)
    p.font.bold = True
    p.font.color.rgb = ALERT_RED
    p.alignment = PP_ALIGN.CENTER

    # Commercial box below
    comm_box3 = s3.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(9.35), Inches(5.4), Inches(3.6), Inches(0.85))
    comm_box3.fill.solid()
    comm_box3.fill.fore_color.rgb = DARK_GREEN
    comm_box3.line.fill.background()
    tf_cb3 = comm_box3.text_frame
    tf_cb3.word_wrap = True
    tf_cb3.margin_left = tf_cb3.margin_right = Inches(0.2)
    tf_cb3.margin_top = Inches(0.1)
    p = tf_cb3.paragraphs[0]
    p.text = "Commercial potential: Very High"
    p.font.size = Pt(11)
    p.font.bold = True
    p.font.color.rgb = TEXT_WHITE
    p2 = tf_cb3.add_paragraph()
    p2.text = "Clear customer base with a direct link to measurable financial losses."
    p2.font.size = Pt(8.5)
    p2.font.color.rgb = RGBColor(220, 252, 231)

    # Customers
    cust_box3 = s3.shapes.add_textbox(Inches(0.4), Inches(5.35), Inches(8.5), Inches(0.6))
    tf_c3 = cust_box3.text_frame
    tf_c3.word_wrap = True
    tf_c3.paragraphs[0].text = "CUSTOMERS"
    tf_c3.paragraphs[0].font.size = Pt(10)
    tf_c3.paragraphs[0].font.bold = True
    tf_c3.paragraphs[0].font.color.rgb = DARK_GREEN
    p_c = tf_c3.add_paragraph()
    p_c.text = "• Farmers & FPOs    • Crop insurers    • Agricultural lenders    • Agri-input companies    • Government agriculture departments"
    p_c.font.size = Pt(9.5)
    p_c.font.color.rgb = TEXT_DARK
    p_c.space_before = Pt(3)

    # How it works
    how_label3 = s3.shapes.add_textbox(Inches(0.4), Inches(6.05), Inches(2.5), Inches(0.25))
    how_label3.text_frame.paragraphs[0].text = "HOW IT WORKS"
    how_label3.text_frame.paragraphs[0].font.size = Pt(10)
    how_label3.text_frame.paragraphs[0].font.bold = True
    how_label3.text_frame.paragraphs[0].font.color.rgb = DARK_GREEN

    s3_flow = [
        ("Enter Location", None, False),
        ("Satellite + Rainfall Data", None, False),
        ("Vegetation & Water Analysis", None, False),
        ("Risk Score", None, True),
        ("Alerts & Insurer Reports", None, False)
    ]
    flow_x = Inches(0.5)
    step_w = Inches(2.1)
    step_h = Inches(0.8)
    gap = Inches(0.4)
    for i, (title, sub, is_dark) in enumerate(s3_flow):
        fx = flow_x + i * (step_w + gap)
        box = s3.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, fx, Inches(6.32), step_w, step_h)
        box.fill.solid()
        box.fill.fore_color.rgb = DARK_GREEN if is_dark else CARD_BG
        box.line.color.rgb = DARK_GREEN
        box.line.width = Pt(1.5)
        tf_f = box.text_frame
        tf_f.vertical_anchor = MSO_ANCHOR.MIDDLE
        tf_f.word_wrap = True
        p_f = tf_f.paragraphs[0]
        p_f.text = title
        p_f.font.size = Pt(10)
        p_f.font.bold = True
        p_f.font.color.rgb = TEXT_WHITE if is_dark else DARK_GREEN
        p_f.alignment = PP_ALIGN.CENTER
        
        if i < len(s3_flow) - 1:
            arr = s3.shapes.add_shape(MSO_SHAPE.RIGHT_ARROW, fx + step_w + Inches(0.08), Inches(6.62), Inches(0.22), Inches(0.18))
            arr.fill.solid()
            arr.fill.fore_color.rgb = ACCENT_GREEN
            arr.line.fill.background()

    add_footer(s3, 3)

    # =========================================================================
    # SLIDE 4: SURAKSHASAT (Disaster Intelligence)
    # =========================================================================
    s4 = prs.slides.add_slide(blank_layout)
    add_slide_header(s4, "ZERO LATENCY • PRODUCT OVERVIEW", "SURAKSHASAT", "AI-powered Disaster Preparedness & Response Intelligence")

    # Left Column
    left_tb4 = s4.shapes.add_textbox(Inches(0.4), Inches(1.5), Inches(3.9), Inches(3.8))
    tf_l4 = left_tb4.text_frame
    tf_l4.word_wrap = True
    
    p = tf_l4.paragraphs[0]
    p.text = "CONCEPT"
    p.font.size = Pt(11)
    p.font.bold = True
    p.font.color.rgb = DARK_GREEN

    p2 = tf_l4.add_paragraph()
    p2.text = "Satellite observations, weather, vulnerability and infrastructure data combined for preparedness and response."
    p2.font.size = Pt(10)
    p2.font.color.rgb = TEXT_DARK
    p2.space_before = Pt(4)

    p3 = tf_l4.add_paragraph()
    p3.text = "THE PROBLEM"
    p3.font.size = Pt(11)
    p3.font.bold = True
    p3.font.color.rgb = DARK_GREEN
    p3.space_before = Pt(14)

    prob_bullets_s4 = [
        "Authorities must quickly identify affected locations",
        "Roads may become inaccessible",
        "Emergency resources need prioritising",
        "Floods and cyclones hit multiple districts at once",
        "Response teams need consolidated geo-intelligence"
    ]
    for b in prob_bullets_s4:
        pb = tf_l4.add_paragraph()
        pb.text = f"•  {b}"
        pb.font.size = Pt(9.5)
        pb.font.color.rgb = TEXT_DARK
        pb.space_before = Pt(5)

    # Center 6 cards
    s4_modules = [
        ("FM", "Map flood-affected\nregions", "Rapid inundation extents"),
        ("CW", "Monitor cyclone\nweather", "Track approach & landfall"),
        ("VS", "Identify vulnerable\nsettlements", "Population at risk"),
        ("RI", "Analyse affected roads\n& infrastructure", "Access and damage"),
        ("PZ", "Generate priority\nresponse zones", "Where to deploy first"),
        ("GR", "Geospatial disaster\nreports", "Shareable situational awareness")
    ]
    add_six_module_grid(s4, s4_modules, Inches(4.5), Inches(1.65))

    # Right: flood photo & offline field card & commercial card
    if os.path.exists("d:/Astra/slide_assets/s4_flood.png"):
        s4.shapes.add_picture("d:/Astra/slide_assets/s4_flood.png", Inches(9.45), Inches(1.4), width=Inches(3.5))

    # Offline-first field reporting box
    off_box = s4.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(9.45), Inches(3.6), Inches(3.5), Inches(1.15))
    off_box.fill.solid()
    off_box.fill.fore_color.rgb = RGBColor(254, 243, 199) # warm amber/cream tint
    off_box.line.color.rgb = RGBColor(245, 158, 11)
    off_box.line.width = Pt(1)
    tf_off = off_box.text_frame
    tf_off.word_wrap = True
    tf_off.margin_left = tf_off.margin_right = Inches(0.2)
    tf_off.margin_top = Inches(0.15)
    p = tf_off.paragraphs[0]
    p.text = "Offline-first field reporting"
    p.font.size = Pt(11)
    p.font.bold = True
    p.font.color.rgb = ALERT_ORANGE
    p2 = tf_off.add_paragraph()
    p2.text = "Rescue teams record damage and sync when connectivity returns."
    p2.font.size = Pt(9.5)
    p2.font.color.rgb = TEXT_DARK
    p2.space_before = Pt(3)

    # Commercial box
    comm_box4 = s4.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(9.45), Inches(4.9), Inches(3.5), Inches(0.75))
    comm_box4.fill.solid()
    comm_box4.fill.fore_color.rgb = DARK_GREEN
    comm_box4.line.fill.background()
    tf_cb4 = comm_box4.text_frame
    tf_cb4.vertical_anchor = MSO_ANCHOR.MIDDLE
    tf_cb4.word_wrap = True
    p = tf_cb4.paragraphs[0]
    p.text = "Commercial potential: High."
    p.font.size = Pt(12)
    p.font.bold = True
    p.font.color.rgb = TEXT_WHITE
    p.alignment = PP_ALIGN.CENTER

    # Customers
    cust_box4 = s4.shapes.add_textbox(Inches(0.4), Inches(5.35), Inches(12.5), Inches(0.6))
    tf_c4 = cust_box4.text_frame
    tf_c4.word_wrap = True
    tf_c4.paragraphs[0].text = "CUSTOMERS"
    tf_c4.paragraphs[0].font.size = Pt(10)
    tf_c4.paragraphs[0].font.bold = True
    tf_c4.paragraphs[0].font.color.rgb = DARK_GREEN
    p_c = tf_c4.add_paragraph()
    p_c.text = "• Disaster management authorities    • State governments    • Municipal corporations    • Infrastructure companies    • Emergency response organisations"
    p_c.font.size = Pt(9.5)
    p_c.font.color.rgb = TEXT_DARK
    p_c.space_before = Pt(3)

    # How it works
    how_label4 = s4.shapes.add_textbox(Inches(0.4), Inches(6.05), Inches(2.5), Inches(0.25))
    how_label4.text_frame.paragraphs[0].text = "HOW IT WORKS"
    how_label4.text_frame.paragraphs[0].font.size = Pt(10)
    how_label4.text_frame.paragraphs[0].font.bold = True
    how_label4.text_frame.paragraphs[0].font.color.rgb = DARK_GREEN

    s4_flow = [
        ("Weather Monitoring", "MOSDAC", False),
        ("Flood & Cyclone Mapping", "Bhuvan • Bhoonidhi • VEDAS", False),
        ("Vulnerable Roads &\nSettlements", None, False),
        ("Priority Response Zones", None, True),
        ("Field Reports", "Offline → sync", False)
    ]
    flow_x = Inches(0.5)
    step_w = Inches(2.1)
    step_h = Inches(0.8)
    gap = Inches(0.4)
    for i, (title, sub, is_dark) in enumerate(s4_flow):
        fx = flow_x + i * (step_w + gap)
        box = s4.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, fx, Inches(6.32), step_w, step_h)
        box.fill.solid()
        box.fill.fore_color.rgb = DARK_GREEN if is_dark else CARD_BG
        box.line.color.rgb = DARK_GREEN
        box.line.width = Pt(1.5)
        tf_f = box.text_frame
        tf_f.vertical_anchor = MSO_ANCHOR.MIDDLE
        tf_f.word_wrap = True
        p_f = tf_f.paragraphs[0]
        p_f.text = title
        p_f.font.size = Pt(9.5)
        p_f.font.bold = True
        p_f.font.color.rgb = TEXT_WHITE if is_dark else DARK_GREEN
        p_f.alignment = PP_ALIGN.CENTER
        if sub:
            p_sub = tf_f.add_paragraph()
            p_sub.text = sub
            p_sub.font.size = Pt(7)
            p_sub.font.color.rgb = TEXT_MUTED
            p_sub.alignment = PP_ALIGN.CENTER
        
        if i < len(s4_flow) - 1:
            arr = s4.shapes.add_shape(MSO_SHAPE.RIGHT_ARROW, fx + step_w + Inches(0.08), Inches(6.62), Inches(0.22), Inches(0.18))
            arr.fill.solid()
            arr.fill.fore_color.rgb = ACCENT_GREEN
            arr.line.fill.background()

    add_footer(s4, 4)

    # =========================================================================
    # SLIDE 5: THE PROBLEM & OBJECTIVE (TERRAPULSE • VISION)
    # =========================================================================
    s5 = prs.slides.add_slide(blank_layout)
    add_slide_header(s5, "TERRAPULSE • VISION", "The Problem & Objective", "AI-Powered Geospatial Risk & Resource Intelligence Platform")

    # Left: The Problem
    prob_tb5 = s5.shapes.add_textbox(Inches(0.4), Inches(1.5), Inches(8.5), Inches(2.2))
    tf_p5 = prob_tb5.text_frame
    tf_p5.word_wrap = True
    p = tf_p5.paragraphs[0]
    p.text = "THE PROBLEM"
    p.font.size = Pt(11)
    p.font.bold = True
    p.font.color.rgb = DARK_GREEN

    p_bullets5 = [
        "India faces interconnected challenges: agricultural degradation, water depletion, environmental change and disasters",
        "Large volumes of Earth Observation, satellite and meteorological data exist — but are fragmented",
        "Decision-makers (agri organisations, infrastructure operators, insurers, disaster authorities) lack a unified, intelligent, accessible decision-support platform"
    ]
    for b in p_bullets5:
        pb = tf_p5.add_paragraph()
        pb.text = f"•  {b}"
        pb.font.size = Pt(11)
        pb.font.color.rgb = TEXT_DARK
        pb.space_before = Pt(8)

    # Large PRIMARY OBJECTIVE Card
    obj_box = s5.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.4), Inches(4.0), Inches(8.5), Inches(1.6))
    obj_box.fill.solid()
    obj_box.fill.fore_color.rgb = DARK_GREEN
    obj_box.line.fill.background()
    tf_ob = obj_box.text_frame
    tf_ob.margin_left = tf_ob.margin_right = Inches(0.3)
    tf_ob.margin_top = Inches(0.2)
    tf_ob.word_wrap = True
    p = tf_ob.paragraphs[0]
    p.text = "PRIMARY OBJECTIVE"
    p.font.size = Pt(10)
    p.font.bold = True
    p.font.color.rgb = LIGHT_GREEN
    
    p2 = tf_ob.add_paragraph()
    p2.text = "\"To develop a scalable, satellite-data-driven intelligence platform that transforms multi-source Earth Observation and environmental datasets into actionable geographical insights for agricultural resilience, sustainable resource management and disaster preparedness.\""
    p2.font.size = Pt(11)
    p2.font.bold = True
    p2.font.color.rgb = TEXT_WHITE
    p2.space_before = Pt(4)

    # Right: Glowing Map & Text Card
    if os.path.exists("d:/Astra/slide_assets/s5_glowmap.png"):
        s5.shapes.add_picture("d:/Astra/slide_assets/s5_glowmap.png", Inches(9.25), Inches(1.4), width=Inches(3.7))

    quote_box = s5.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(9.25), Inches(4.0), Inches(3.7), Inches(1.6))
    quote_box.fill.solid()
    quote_box.fill.fore_color.rgb = DARK_GREEN
    quote_box.line.fill.background()
    tf_qb = quote_box.text_frame
    tf_qb.vertical_anchor = MSO_ANCHOR.MIDDLE
    tf_qb.margin_left = tf_qb.margin_right = Inches(0.25)
    tf_qb.word_wrap = True
    p = tf_qb.paragraphs[0]
    p.text = "From raw satellite data"
    p.font.size = Pt(13)
    p.font.bold = True
    p.font.color.rgb = TEXT_WHITE
    p.alignment = PP_ALIGN.CENTER
    p2 = tf_qb.add_paragraph()
    p2.text = "...to a single platform that any decision-maker can act on."
    p2.font.size = Pt(10.5)
    p2.font.color.rgb = RGBColor(220, 252, 231)
    p2.space_before = Pt(4)
    p2.alignment = PP_ALIGN.CENTER

    # Bottom: The Gap We Close
    gap_label = s5.shapes.add_textbox(Inches(0.4), Inches(5.8), Inches(3.0), Inches(0.25))
    gap_label.text_frame.paragraphs[0].text = "THE GAP WE CLOSE"
    gap_label.text_frame.paragraphs[0].font.size = Pt(10.5)
    gap_label.text_frame.paragraphs[0].font.bold = True
    gap_label.text_frame.paragraphs[0].font.color.rgb = DARK_GREEN

    gap_steps = [
        ("Fragmented Data Sources", "EO • weather • geo data", False, None),
        ("No Unified Intelligence", "The gap", False, RGBColor(245, 158, 11)),
        ("TerraPulse", "AI geospatial engine", True, None),
        ("Actionable Decisions", "Reports • alerts • maps", False, None)
    ]
    flow_x = Inches(0.5)
    step_w = Inches(2.7)
    step_h = Inches(0.8)
    gap = Inches(0.4)
    for i, (title, sub, is_dark, border_col) in enumerate(gap_steps):
        fx = flow_x + i * (step_w + gap)
        box = s5.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, fx, Inches(6.15), step_w, step_h)
        box.fill.solid()
        if is_dark:
            box.fill.fore_color.rgb = DARK_GREEN
            box.line.color.rgb = DARK_GREEN
        elif border_col:
            box.fill.fore_color.rgb = RGBColor(254, 243, 199)
            box.line.color.rgb = border_col
            box.line.width = Pt(1.5)
        else:
            box.fill.fore_color.rgb = CARD_BG
            box.line.color.rgb = DARK_GREEN
            box.line.width = Pt(1.5)
            
        tf_f = box.text_frame
        tf_f.vertical_anchor = MSO_ANCHOR.MIDDLE
        tf_f.word_wrap = True
        p_f = tf_f.paragraphs[0]
        p_f.text = title
        p_f.font.size = Pt(10.5)
        p_f.font.bold = True
        p_f.font.color.rgb = TEXT_WHITE if is_dark else (ALERT_ORANGE if border_col else DARK_GREEN)
        p_f.alignment = PP_ALIGN.CENTER
        if sub:
            p_sub = tf_f.add_paragraph()
            p_sub.text = sub
            p_sub.font.size = Pt(8)
            p_sub.font.color.rgb = RGBColor(220, 252, 231) if is_dark else TEXT_MUTED
            p_sub.alignment = PP_ALIGN.CENTER
        
        if i < len(gap_steps) - 1:
            arr = s5.shapes.add_shape(MSO_SHAPE.RIGHT_ARROW, fx + step_w + Inches(0.08), Inches(6.45), Inches(0.22), Inches(0.18))
            arr.fill.solid()
            arr.fill.fore_color.rgb = ACCENT_GREEN
            arr.line.fill.background()

    add_footer(s5, 5)

    # =========================================================================
    # SLIDE 6: PROPOSED SOLUTION (TERRAPULSE • SOLUTION)
    # =========================================================================
    s6 = prs.slides.add_slide(blank_layout)
    add_slide_header(s6, "TERRAPULSE • SOLUTION", "Proposed Solution", "One AI engine, four national data portals, four intelligence domains")

    # Left bullets
    left_tb6 = s6.shapes.add_textbox(Inches(0.4), Inches(1.5), Inches(4.3), Inches(3.0))
    tf_l6 = left_tb6.text_frame
    tf_l6.word_wrap = True
    
    sol_bullets = [
        "Integrates imagery, environmental indicators, meteorological and geographic data from Bhoonidhi, Bhuvan, MOSDAC and VEDAS",
        "Correlates geographical and temporal data to monitor agriculture, assess water, detect change and map disaster vulnerabilities",
        "AI-assisted analysis, automated risk assessment, interactive maps and actionable reports",
        "Moves organisations from fragmented monitoring to integrated, proactive decision-making"
    ]
    for idx, b in enumerate(sol_bullets):
        pb = tf_l6.paragraphs[0] if idx == 0 else tf_l6.add_paragraph()
        pb.text = f"•  {b}"
        pb.font.size = Pt(10)
        pb.font.color.rgb = TEXT_DARK
        pb.space_before = Pt(6)

    # Mockup image bottom left
    if os.path.exists("d:/Astra/slide_assets/s6_mockup.png"):
        s6.shapes.add_picture("d:/Astra/slide_assets/s6_mockup.png", Inches(0.4), Inches(4.7), width=Inches(4.1))

    # Center/Right: HOW IT FITS TOGETHER
    hit_label = s6.shapes.add_textbox(Inches(4.8), Inches(1.4), Inches(4.0), Inches(0.25))
    hit_label.text_frame.paragraphs[0].text = "HOW IT FITS TOGETHER"
    hit_label.text_frame.paragraphs[0].font.size = Pt(10.5)
    hit_label.text_frame.paragraphs[0].font.bold = True
    hit_label.text_frame.paragraphs[0].font.color.rgb = DARK_GREEN

    # Left input pills (4 portals)
    portals_pills = [
        ("Bhoonidhi", "satellite imagery"),
        ("Bhuvan", "geo & water maps"),
        ("MOSDAC", "weather & rainfall"),
        ("VEDAS", "environmental data")
    ]
    py_start = Inches(1.8)
    pw = Inches(2.0)
    ph = Inches(0.85)
    pgap = Inches(0.22)
    for idx, (p_title, p_sub) in enumerate(portals_pills):
        py = py_start + idx * (ph + pgap)
        p_shape = s6.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(4.8), py, pw, ph)
        p_shape.fill.solid()
        p_shape.fill.fore_color.rgb = CARD_BG
        p_shape.line.color.rgb = DARK_GREEN
        p_shape.line.width = Pt(1.5)
        tf_ps = p_shape.text_frame
        tf_ps.vertical_anchor = MSO_ANCHOR.MIDDLE
        p = tf_ps.paragraphs[0]
        p.text = p_title
        p.font.size = Pt(10.5)
        p.font.bold = True
        p.font.color.rgb = DARK_GREEN
        p.alignment = PP_ALIGN.CENTER
        p_s = tf_ps.add_paragraph()
        p_s.text = p_sub
        p_s.font.size = Pt(8)
        p_s.font.color.rgb = TEXT_MUTED
        p_s.alignment = PP_ALIGN.CENTER

    # Center Engine Box
    engine_box = s6.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(7.4), Inches(2.8), Inches(2.1), Inches(1.8))
    engine_box.fill.solid()
    engine_box.fill.fore_color.rgb = DARK_GREEN
    engine_box.line.fill.background()
    tf_eb = engine_box.text_frame
    tf_eb.vertical_anchor = MSO_ANCHOR.MIDDLE
    p = tf_eb.paragraphs[0]
    p.text = "TerraPulse"
    p.font.size = Pt(16)
    p.font.bold = True
    p.font.color.rgb = TEXT_WHITE
    p.alignment = PP_ALIGN.CENTER
    p2 = tf_eb.add_paragraph()
    p2.text = "AI Engine"
    p2.font.size = Pt(13)
    p2.font.bold = True
    p2.font.color.rgb = LIGHT_GREEN
    p2.alignment = PP_ALIGN.CENTER

    # Right output pills (4 domains + reports card)
    out_pills = [
        ("Agriculture", "KrishiSat"),
        ("Water", "JalDrishti"),
        ("Disaster", "SurakshaSat"),
        ("Infrastructure", "core platform")
    ]
    for idx, (o_title, o_sub) in enumerate(out_pills):
        oy = py_start + idx * (ph + pgap)
        o_shape = s6.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(10.1), oy, pw, ph)
        o_shape.fill.solid()
        o_shape.fill.fore_color.rgb = CARD_BG
        o_shape.line.color.rgb = DARK_GREEN
        o_shape.line.width = Pt(1.5)
        tf_os = o_shape.text_frame
        tf_os.vertical_anchor = MSO_ANCHOR.MIDDLE
        p = tf_os.paragraphs[0]
        p.text = o_title
        p.font.size = Pt(10.5)
        p.font.bold = True
        p.font.color.rgb = DARK_GREEN
        p.alignment = PP_ALIGN.CENTER
        p_s = tf_os.add_paragraph()
        p_s.text = o_sub
        p_s.font.size = Pt(8)
        p_s.font.color.rgb = TEXT_MUTED
        p_s.alignment = PP_ALIGN.CENTER

    # Green button below right pills
    rep_btn = s6.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(10.1), Inches(6.05), pw, Inches(0.65))
    rep_btn.fill.solid()
    rep_btn.fill.fore_color.rgb = ACCENT_GREEN
    rep_btn.line.fill.background()
    tf_rb = rep_btn.text_frame
    tf_rb.vertical_anchor = MSO_ANCHOR.MIDDLE
    p = tf_rb.paragraphs[0]
    p.text = "Risk Reports & Decision\nDashboard"
    p.font.size = Pt(9)
    p.font.bold = True
    p.font.color.rgb = TEXT_WHITE
    p.alignment = PP_ALIGN.CENTER

    # Bottom Pill Banner: One unified platform
    plat_pill = s6.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(4.8), Inches(6.8), Inches(7.3), Inches(0.42))
    plat_pill.fill.solid()
    plat_pill.fill.fore_color.rgb = RGBColor(240, 253, 244) # pale green tint
    plat_pill.line.color.rgb = DARK_GREEN
    plat_pill.line.width = Pt(1)
    tf_pp = plat_pill.text_frame
    tf_pp.vertical_anchor = MSO_ANCHOR.MIDDLE
    p = tf_pp.paragraphs[0]
    p.text = "One unified platform: TerraPulse core • KrishiSat • JalDrishti • SurakshaSat"
    p.font.size = Pt(10)
    p.font.bold = True
    p.font.color.rgb = DARK_GREEN
    p.alignment = PP_ALIGN.CENTER

    add_footer(s6, 6)

    # =========================================================================
    # SLIDE 7: THANK YOU SLIDE (Team Zero Latency)
    # =========================================================================
    s7 = prs.slides.add_slide(blank_layout)
    
    # Use full thank you background image if available
    if os.path.exists("d:/Astra/slide_assets/slide_7_full.png"):
        s7.shapes.add_picture("d:/Astra/slide_assets/slide_7_full.png", 0, 0, width=Inches(13.333), height=Inches(7.5))
    else:
        bg = s7.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, Inches(13.333), Inches(7.5))
        bg.fill.solid()
        bg.fill.fore_color.rgb = RGBColor(7, 31, 17)
        bg.line.fill.background()

    # Overlay editable text boxes directly on top so users can edit everything!
    tb_ty = s7.shapes.add_textbox(Inches(0.8), Inches(1.8), Inches(6.5), Inches(1.8))
    tf_ty = tb_ty.text_frame
    tf_ty.word_wrap = True
    p = tf_ty.paragraphs[0]
    p.text = "Thank You!"
    p.font.size = Pt(58)
    p.font.bold = True
    p.font.color.rgb = TEXT_WHITE
    p.font.name = "Segoe UI"

    p2 = tf_ty.add_paragraph()
    p2.text = "Innovating for a Resilient India"
    p2.font.size = Pt(22)
    p2.font.bold = True
    p2.font.color.rgb = RGBColor(187, 247, 208)
    p2.space_before = Pt(8)

    p3 = tf_ty.add_paragraph()
    p3.text = "Team Zero Latency"
    p3.font.size = Pt(16)
    p3.font.color.rgb = TEXT_WHITE
    p3.space_before = Pt(16)

    # Pill: ASTRA Hackathon
    pill7 = s7.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), Inches(4.5), Inches(2.8), Inches(0.55))
    pill7.fill.solid()
    pill7.fill.fore_color.rgb = RGBColor(7, 31, 17)
    pill7.line.color.rgb = RGBColor(187, 247, 208)
    pill7.line.width = Pt(1.5)
    tf_p7 = pill7.text_frame
    tf_p7.vertical_anchor = MSO_ANCHOR.MIDDLE
    p = tf_p7.paragraphs[0]
    p.text = "ASTRA Hackathon"
    p.font.size = Pt(12)
    p.font.bold = True
    p.font.color.rgb = TEXT_WHITE
    p.alignment = PP_ALIGN.CENTER

    prs.save(output_path)
    print(f"Editable presentation successfully saved at: {output_path}")

if __name__ == "__main__":
    build_editable_deck("d:/Astra/TERRAPULSE_EDITABLE_DECK.pptx")
