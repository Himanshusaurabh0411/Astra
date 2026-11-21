import pptx
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE

def create_deck(output_path="TERRAPULSE_ASTRA_2026.pptx"):
    prs = pptx.Presentation()
    # 16:9 Widescreen dimensions
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    blank_layout = prs.slide_layouts[6]

    # Theme Colors
    BG_DARK = RGBColor(7, 11, 22)        # Deep space black/navy
    CARD_BG = RGBColor(15, 23, 42)       # Slate 900
    CARD_BORDER = RGBColor(30, 41, 59)   # Slate 800
    CARD_HOVER = RGBColor(23, 37, 63)    # Deep navy blue
    
    CYAN_ACCENT = RGBColor(56, 189, 248) # Sky/Cyan 400
    CYAN_BRIGHT = RGBColor(6, 182, 212)  # Cyan 500
    INDIGO_ACC = RGBColor(99, 102, 241)  # Indigo 500
    ORANGE_ACC = RGBColor(249, 115, 22)  # Orange 500 (alerts)
    GREEN_ACC = RGBColor(16, 185, 129)   # Emerald 500 (success)
    
    TEXT_WHITE = RGBColor(248, 250, 252) # White
    TEXT_MUTED = RGBColor(148, 163, 184) # Slate 400
    TEXT_DIM = RGBColor(100, 116, 139)   # Slate 500

    def add_background(slide):
        bg = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, Inches(13.333), Inches(7.5))
        bg.fill.solid()
        bg.fill.fore_color.rgb = BG_DARK
        bg.line.fill.background()
        return bg

    def add_header(slide, badge_text, title_text, category_color=CYAN_ACCENT):
        # Badge pill
        badge_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.4), Inches(11.7), Inches(0.4))
        tf_b = badge_box.text_frame
        tf_b.word_wrap = True
        tf_b.margin_top = tf_b.margin_bottom = tf_b.margin_left = tf_b.margin_right = 0
        p_b = tf_b.paragraphs[0]
        p_b.text = badge_text.upper()
        p_b.font.size = Pt(10)
        p_b.font.bold = True
        p_b.font.color.rgb = category_color
        p_b.font.name = "Segoe UI"

        # Main Title
        title_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.75), Inches(11.7), Inches(0.65))
        tf_t = title_box.text_frame
        tf_t.word_wrap = True
        tf_t.margin_top = tf_t.margin_bottom = tf_t.margin_left = tf_t.margin_right = 0
        p_t = tf_t.paragraphs[0]
        p_t.text = title_text
        p_t.font.size = Pt(22)
        p_t.font.bold = True
        p_t.font.color.rgb = TEXT_WHITE
        p_t.font.name = "Segoe UI"

    # ==========================================
    # SLIDE 1: TITLE & HERO SLIDE
    # ==========================================
    s1 = prs.slides.add_slide(blank_layout)
    add_background(s1)
    
    # Event header pill
    pill = s1.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), Inches(0.8), Inches(7.2), Inches(0.4))
    pill.fill.solid()
    pill.fill.fore_color.rgb = RGBColor(17, 24, 39)
    pill.line.color.rgb = RGBColor(56, 189, 248)
    pill.line.width = Pt(1)
    tf = pill.text_frame
    tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    p = tf.paragraphs[0]
    p.text = "ASTRA 2026 • ANTERiX CLUB • VIT BHOPAL | DUAL-DOMAIN FUSION"
    p.font.size = Pt(10)
    p.font.bold = True
    p.font.color.rgb = CYAN_ACCENT
    p.alignment = PP_ALIGN.CENTER

    # Big Title
    tb = s1.shapes.add_textbox(Inches(0.8), Inches(1.5), Inches(11.7), Inches(1.8))
    tf = tb.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = "TERRAPULSE"
    p.font.size = Pt(54)
    p.font.bold = True
    p.font.color.rgb = TEXT_WHITE
    p.font.name = "Segoe UI"

    p2 = tf.add_paragraph()
    p2.text = "Turning Satellite Data into Real-World Decisions"
    p2.font.size = Pt(24)
    p2.font.bold = True
    p2.font.color.rgb = CYAN_ACCENT
    p2.font.name = "Segoe UI"

    p3 = tf.add_paragraph()
    p3.text = "A Multi-Portal Geospatial Intelligence Engine & NavIC-Enabled Offline Tactical Response Mesh"
    p3.font.size = Pt(14)
    p3.font.color.rgb = TEXT_MUTED
    p3.font.name = "Segoe UI"

    # 4 Pillar Stat Cards at the Bottom
    pillars = [
        ("4 NATIONAL PORTALS", "MOSDAC • Bhoonidhi • VEDAS • Bhuvan", "Official ISRO Repositories", INDIGO_ACC),
        ("0–6h ADVANCE NOWCAST", "INSAT-3DS + GSMaP Precipitation", "Flash-flood anomaly alerting", CYAN_ACCENT),
        ("ALL-WEATHER SAR RADAR", "NISAR & EOS-04 Microwave SAR", "Cloud-penetrating inundation", ORANGE_ACC),
        ("OFFLINE RESCUE MESH", "NavIC Geolocation + Sub-GHz LoRa", "Zero cellular & SIM dependency", GREEN_ACC)
    ]
    card_w = Inches(2.7)
    card_gap = Inches(0.3)
    card_h = Inches(2.2)
    start_x = Inches(0.8)
    start_y = Inches(4.5)

    for i, (title, sub, detail, color) in enumerate(pillars):
        x = start_x + i * (card_w + card_gap)
        c = s1.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x, start_y, card_w, card_h)
        c.fill.solid()
        c.fill.fore_color.rgb = CARD_BG
        c.line.color.rgb = CARD_BORDER
        c.line.width = Pt(1)
        
        # Color bar on top of card
        top_bar = s1.shapes.add_shape(MSO_SHAPE.RECTANGLE, x + Inches(0.1), start_y + Inches(0.1), card_w - Inches(0.2), Inches(0.06))
        top_bar.fill.solid()
        top_bar.fill.fore_color.rgb = color
        top_bar.line.fill.background()

        tf = c.text_frame
        tf.margin_left = tf.margin_right = Inches(0.2)
        tf.margin_top = Inches(0.3)
        tf.word_wrap = True
        
        p = tf.paragraphs[0]
        p.text = title
        p.font.size = Pt(11)
        p.font.bold = True
        p.font.color.rgb = color
        
        p2 = tf.add_paragraph()
        p2.text = sub
        p2.font.size = Pt(12)
        p2.font.bold = True
        p2.font.color.rgb = TEXT_WHITE
        p2.space_before = Pt(6)
        
        p3 = tf.add_paragraph()
        p3.text = detail
        p3.font.size = Pt(10)
        p3.font.color.rgb = TEXT_MUTED
        p3.space_before = Pt(6)

    # ==========================================
    # SLIDE 2: PROBLEM IDENTIFICATION & RESEARCH
    # ==========================================
    s2 = prs.slides.add_slide(blank_layout)
    add_background(s2)
    add_header(s2, "01 / Problem Identification & Research", "The Fatal Divide: Space Telemetry vs. Ground Blackout")

    # The Dashboard Trap summary banner
    banner = s2.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), Inches(1.5), Inches(11.733), Inches(0.9))
    banner.fill.solid()
    banner.fill.fore_color.rgb = RGBColor(26, 16, 28)
    banner.line.color.rgb = RGBColor(239, 68, 68)
    banner.line.width = Pt(1)
    tf = banner.text_frame
    tf.margin_left = tf.margin_right = Inches(0.25)
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = "THE 'DASHBOARD TRAP': Central command centers possess multi-terabyte satellite hazard maps, but in severe cyclones & floods, ground telecommunications collapse. Orbital intelligence is trapped in the cloud while boots on the ground operate blind."
    p.font.size = Pt(11)
    p.font.color.rgb = RGBColor(254, 202, 202)
    p.font.bold = True

    # 3 Problem Breakdown Cards
    prob_cards = [
        ("THE CLOUD BLINDSPOT", 
         "Optical Satellite Failure",
         "Standard optical satellites (Sentinel-2, Landsat-8) are completely blinded by thick monsoon clouds and convective storm systems. By the time skies clear days later, the disaster has peaked.",
         ORANGE_ACC),
        ("THE TELECOM COLLAPSE", 
         "Complete Last-Mile Blackout",
         "When cyclonic winds exceed 100 km/h and floodwaters submerge power grids, cellular towers collapse. High-tech cloud web dashboards cannot be opened by NDRF or field rescue teams.",
         RGBColor(239, 68, 68)),
        ("ISRO DATA SILOS & OVERHEAD", 
         "Gigabyte Raster Bloat",
         "Bhuvan, MOSDAC, Bhoonidhi, and VEDAS operate in separate web silos. Downloading 2GB+ raw GeoTIFF rasters is impossible over bandwidth-choked or disrupted disaster networks.",
         CYAN_ACCENT)
    ]

    card_w = Inches(3.7)
    gap = Inches(0.31)
    y_pos = Inches(2.65)
    for i, (tag, h, body, col) in enumerate(prob_cards):
        x = Inches(0.8) + i * (card_w + gap)
        c = s2.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x, y_pos, card_w, Inches(4.2))
        c.fill.solid()
        c.fill.fore_color.rgb = CARD_BG
        c.line.color.rgb = CARD_BORDER
        c.line.width = Pt(1)

        # header strip
        top = s2.shapes.add_shape(MSO_SHAPE.RECTANGLE, x + Inches(0.15), y_pos + Inches(0.15), card_w - Inches(0.3), Inches(0.08))
        top.fill.solid()
        top.fill.fore_color.rgb = col
        top.line.fill.background()

        tf = c.text_frame
        tf.margin_left = tf.margin_right = Inches(0.25)
        tf.margin_top = Inches(0.4)
        tf.word_wrap = True
        
        p = tf.paragraphs[0]
        p.text = tag
        p.font.size = Pt(11)
        p.font.bold = True
        p.font.color.rgb = col

        p2 = tf.add_paragraph()
        p2.text = h
        p2.font.size = Pt(14)
        p2.font.bold = True
        p2.font.color.rgb = TEXT_WHITE
        p2.space_before = Pt(8)

        p3 = tf.add_paragraph()
        p3.text = body
        p3.font.size = Pt(11)
        p3.font.color.rgb = TEXT_MUTED
        p3.space_before = Pt(12)

    # ==========================================
    # SLIDE 3: PROPOSED SOLUTION & CORE VISION
    # ==========================================
    s3 = prs.slides.add_slide(blank_layout)
    add_background(s3)
    add_header(s3, "02 / Proposed Solution & Core Vision", "TerraPulse: Space-to-Ground Intelligence Ecosystem")

    # Problem Statement Callout Box
    ps_box = s3.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), Inches(1.5), Inches(11.733), Inches(1.8))
    ps_box.fill.solid()
    ps_box.fill.fore_color.rgb = RGBColor(15, 30, 50)
    ps_box.line.color.rgb = CYAN_ACCENT
    ps_box.line.width = Pt(1.5)
    tf = ps_box.text_frame
    tf.margin_left = tf.margin_right = Inches(0.3)
    tf.margin_top = Inches(0.2)
    tf.word_wrap = True
    
    p = tf.paragraphs[0]
    p.text = "OFFICIAL COMBINED PROBLEM STATEMENT (DOMAINS 03 + 04):"
    p.font.size = Pt(10)
    p.font.bold = True
    p.font.color.rgb = CYAN_ACCENT

    p2 = tf.add_paragraph()
    p2.text = "\"Develop 'TerraPulse' — an integrated geospatial intelligence and tactical rescue coordination platform that unifies India's four primary Earth observation portals (MOSDAC, Bhoonidhi, VEDAS, Bhuvan) to transform satellite telemetry into actionable decisions; and simultaneously solves the critical last-mile communication blackout through passive NavIC positioning and an offline P2P mesh relay network.\""
    p2.font.size = Pt(12)
    p2.font.bold = True
    p2.font.color.rgb = TEXT_WHITE
    p2.space_before = Pt(4)

    # 3 Solution Pillars
    sol_pillars = [
        ("AUTONOMOUS PORTAL FUSION",
         "Cloud workers continuously ingest MOSDAC GSMaP rain nowcasts. Rainfall >15 mm/hr auto-triggers Bhoonidhi all-weather SAR acquisitions with zero human delay.",
         INDIGO_ACC),
        ("ACTIONABLE VECTORIZATION",
         "Instead of transmitting multi-gigabyte raster GeoTIFFs, TerraPulse extracts flood boundaries and safe dry roads into lightweight vector packets (<100 KB GeoJSON).",
         CYAN_ACCENT),
        ("OFFLINE TACTICAL MESH",
         "Intelligence reaches field rescue boats and stranded citizens via indigenous NavIC (IRNSS) passive geolocation and Sub-GHz LoRa mesh in 100% cellular-dead zones.",
         GREEN_ACC)
    ]

    card_w = Inches(3.7)
    gap = Inches(0.31)
    y_pos = Inches(3.55)
    for i, (title, body, col) in enumerate(sol_pillars):
        x = Inches(0.8) + i * (card_w + gap)
        c = s3.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x, y_pos, card_w, Inches(3.4))
        c.fill.solid()
        c.fill.fore_color.rgb = CARD_BG
        c.line.color.rgb = CARD_BORDER
        c.line.width = Pt(1)

        tf = c.text_frame
        tf.margin_left = tf.margin_right = Inches(0.25)
        tf.margin_top = Inches(0.3)
        tf.word_wrap = True

        p = tf.paragraphs[0]
        p.text = f"PILLAR {i+1}"
        p.font.size = Pt(10)
        p.font.bold = True
        p.font.color.rgb = col

        p2 = tf.add_paragraph()
        p2.text = title
        p2.font.size = Pt(14)
        p2.font.bold = True
        p2.font.color.rgb = TEXT_WHITE
        p2.space_before = Pt(6)

        p3 = tf.add_paragraph()
        p3.text = body
        p3.font.size = Pt(11)
        p3.font.color.rgb = TEXT_MUTED
        p3.space_before = Pt(10)

    # ==========================================
    # SLIDE 4: THE 4-PORTAL ISRO INTEGRATION MATRIX
    # ==========================================
    s4 = prs.slides.add_slide(blank_layout)
    add_background(s4)
    add_header(s4, "03 / National Space Portals • Evaluation Priority", "The 4-Portal ISRO Integration Matrix: Eliminating Data Silos")

    portals = [
        ("MOSDAC", "SAC, Ahmedabad",
         "INSAT-3D/3DR/3DS TIR1, GSMaP_ISRO Hourly Rain (0.1°), MT-SAPHIR",
         "Atmospheric tracking, extreme convective storm nowcasting",
         "0–6h advance flash-flood warning alerts (>15 mm/hr trigger)",
         ORANGE_ACC),
        ("BHOONIDHI", "NRSC, Hyderabad",
         "NISAR S/L-band SAR, EOS-04 L2B ARD, Sentinel-1/2, Landsat-8/9",
         "All-weather microwave radar imaging; cloud & canopy penetration",
         "Delineated flood extent polygon and standing water depth mask",
         CYAN_ACCENT),
        ("VEDAS", "SAC, Ahmedabad",
         "Cartosat DEM, STAL Cadastral AI, KrishiDSS, INDUS Interferometry",
         "Hydrological slope analysis & AI-driven road accessibility routing",
         "Automated submerged roadway detection & safe dry evacuation corridor",
         INDIGO_ACC),
        ("BHUVAN", "NRSC, Hyderabad",
         "1:50,000 LULC Vector Maps, Gram Panchayat Cadastres, OGC WMS/WMTS",
         "Administrative spatial contextualization & critical infrastructure overlay",
         "Triage maps identifying submerged hospitals, schools & cutoff villages",
         GREEN_ACC)
    ]

    card_w = Inches(2.75)
    gap = Inches(0.24)
    y_pos = Inches(1.5)

    for i, (name, center, prods, role, output, col) in enumerate(portals):
        x = Inches(0.8) + i * (card_w + gap)
        c = s4.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x, y_pos, card_w, Inches(5.4))
        c.fill.solid()
        c.fill.fore_color.rgb = CARD_BG
        c.line.color.rgb = CARD_BORDER
        c.line.width = Pt(1)

        # Accent header badge
        badge = s4.shapes.add_shape(MSO_SHAPE.RECTANGLE, x + Inches(0.1), y_pos + Inches(0.1), card_w - Inches(0.2), Inches(0.45))
        badge.fill.solid()
        badge.fill.fore_color.rgb = col
        badge.line.fill.background()
        tf_b = badge.text_frame
        tf_b.vertical_anchor = MSO_ANCHOR.MIDDLE
        p = tf_b.paragraphs[0]
        p.text = name
        p.font.size = Pt(14)
        p.font.bold = True
        p.font.color.rgb = RGBColor(0, 0, 0) if col in [CYAN_ACCENT, GREEN_ACC] else TEXT_WHITE
        p.alignment = PP_ALIGN.CENTER

        tf = c.text_frame
        tf.margin_left = tf.margin_right = Inches(0.2)
        tf.margin_top = Inches(0.65)
        tf.word_wrap = True

        p = tf.paragraphs[0]
        p.text = center
        p.font.size = Pt(9)
        p.font.color.rgb = TEXT_DIM

        p2 = tf.add_paragraph()
        p2.text = "PRIMARY PRODUCTS:"
        p2.font.size = Pt(9)
        p2.font.bold = True
        p2.font.color.rgb = col
        p2.space_before = Pt(8)

        p3 = tf.add_paragraph()
        p3.text = prods
        p3.font.size = Pt(10)
        p3.font.color.rgb = TEXT_WHITE
        p3.space_before = Pt(2)

        p4 = tf.add_paragraph()
        p4.text = "OPERATIONAL ROLE:"
        p4.font.size = Pt(9)
        p4.font.bold = True
        p4.font.color.rgb = col
        p4.space_before = Pt(10)

        p5 = tf.add_paragraph()
        p5.text = role
        p5.font.size = Pt(10)
        p5.font.color.rgb = TEXT_MUTED
        p5.space_before = Pt(2)

        p6 = tf.add_paragraph()
        p6.text = "ACTIONABLE OUTPUT:"
        p6.font.size = Pt(9)
        p6.font.bold = True
        p6.font.color.rgb = col
        p6.space_before = Pt(10)

        p7 = tf.add_paragraph()
        p7.text = output
        p7.font.size = Pt(10)
        p7.font.bold = True
        p7.font.color.rgb = TEXT_WHITE
        p7.space_before = Pt(2)

    # ==========================================
    # SLIDE 5: SYSTEM ARCHITECTURE & WORKFLOW
    # ==========================================
    s5 = prs.slides.add_slide(blank_layout)
    add_background(s5)
    add_header(s5, "04 / System Architecture & Workflow", "Space-to-Ground Operational Intelligence Pipeline")

    tiers = [
        ("TIER 1: MULTI-PORTAL SPACE INGESTION",
         "MOSDAC Precipitation Feeds (GSMaP 0.1° / INSAT-3DS)  •  Bhoonidhi STAC Catalog (EOS-04 / NISAR SAR)  •  VEDAS Cartosat DEM Elevation Models  •  Bhuvan OGC WMS/WMTS Critical Infrastructure Layers",
         INDIGO_ACC),
        ("TIER 2: TERRAPULSE CORE GEOAI ENGINE (CLOUD / EDGE)",
         "Automated Inundation Thresholding (Radar backscatter water segmentation)  •  DEM Hydrological Runoff Routing (Submerged road classification)  •  Vectorization & Compression (<100 KB GeoJSON Micro-Packets)",
         CYAN_ACCENT),
        ("TIER 3A: CENTRAL WEB COMMAND GIS",
         "Full-featured interactive Leaflet / MapLibre GIS Dashboard for NDRF, SDMA & State Disaster Operations Centers. Live multi-layer hazard overlays and evacuation routing.",
         ORANGE_ACC),
        ("TIER 3B: OFFLINE TACTICAL FIELD MESH",
         "Progressive Web App (PWA) with offline vector tile caching. Receives compressed hazard packets over Sub-GHz LoRa mesh and locks sub-meter coordinates via passive NavIC.",
         GREEN_ACC)
    ]

    # Tier 1
    t1_box = s5.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), Inches(1.5), Inches(11.733), Inches(1.1))
    t1_box.fill.solid()
    t1_box.fill.fore_color.rgb = CARD_BG
    t1_box.line.color.rgb = INDIGO_ACC
    t1_box.line.width = Pt(1.5)
    tf = t1_box.text_frame
    tf.margin_left = tf.margin_right = Inches(0.3)
    tf.margin_top = Inches(0.15)
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = tiers[0][0]
    p.font.size = Pt(11)
    p.font.bold = True
    p.font.color.rgb = INDIGO_ACC
    p2 = tf.add_paragraph()
    p2.text = tiers[0][1]
    p2.font.size = Pt(11)
    p2.font.color.rgb = TEXT_WHITE
    p2.space_before = Pt(4)

    # Down Arrow 1
    arr1 = s5.shapes.add_shape(MSO_SHAPE.DOWN_ARROW, Inches(6.3), Inches(2.7), Inches(0.7), Inches(0.35))
    arr1.fill.solid()
    arr1.fill.fore_color.rgb = CYAN_ACCENT
    arr1.line.fill.background()

    # Tier 2 (Engine)
    t2_box = s5.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), Inches(3.15), Inches(11.733), Inches(1.3))
    t2_box.fill.solid()
    t2_box.fill.fore_color.rgb = RGBColor(15, 30, 55)
    t2_box.line.color.rgb = CYAN_ACCENT
    t2_box.line.width = Pt(2)
    tf = t2_box.text_frame
    tf.margin_left = tf.margin_right = Inches(0.3)
    tf.margin_top = Inches(0.18)
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = tiers[1][0]
    p.font.size = Pt(12)
    p.font.bold = True
    p.font.color.rgb = CYAN_ACCENT
    p2 = tf.add_paragraph()
    p2.text = tiers[1][1]
    p2.font.size = Pt(11)
    p2.font.color.rgb = TEXT_WHITE
    p2.space_before = Pt(4)

    # Down Arrow 2
    arr2 = s5.shapes.add_shape(MSO_SHAPE.DOWN_ARROW, Inches(6.3), Inches(4.55), Inches(0.7), Inches(0.35))
    arr2.fill.solid()
    arr2.fill.fore_color.rgb = GREEN_ACC
    arr2.line.fill.background()

    # Tier 3 Dual output boxes
    t3a = s5.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), Inches(5.0), Inches(5.7), Inches(1.9))
    t3a.fill.solid()
    t3a.fill.fore_color.rgb = CARD_BG
    t3a.line.color.rgb = ORANGE_ACC
    t3a.line.width = Pt(1.5)
    tf = t3a.text_frame
    tf.margin_left = tf.margin_right = Inches(0.25)
    tf.margin_top = Inches(0.18)
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = tiers[2][0]
    p.font.size = Pt(11)
    p.font.bold = True
    p.font.color.rgb = ORANGE_ACC
    p2 = tf.add_paragraph()
    p2.text = tiers[2][1]
    p2.font.size = Pt(10.5)
    p2.font.color.rgb = TEXT_WHITE
    p2.space_before = Pt(4)

    t3b = s5.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(6.833), Inches(5.0), Inches(5.7), Inches(1.9))
    t3b.fill.solid()
    t3b.fill.fore_color.rgb = CARD_BG
    t3b.line.color.rgb = GREEN_ACC
    t3b.line.width = Pt(1.5)
    tf = t3b.text_frame
    tf.margin_left = tf.margin_right = Inches(0.25)
    tf.margin_top = Inches(0.18)
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = tiers[3][0]
    p.font.size = Pt(11)
    p.font.bold = True
    p.font.color.rgb = GREEN_ACC
    p2 = tf.add_paragraph()
    p2.text = tiers[3][1]
    p2.font.size = Pt(10.5)
    p2.font.color.rgb = TEXT_WHITE
    p2.space_before = Pt(4)

    # ==========================================
    # SLIDE 6: DOMAIN 04 DEEP DIVE (NavIC & MESH)
    # ==========================================
    s6 = prs.slides.add_slide(blank_layout)
    add_background(s6)
    add_header(s6, "05 / Domain 04 Execution • Satellite Communications", "NavIC Positioning & Zero-Cellular Tactical Mesh")

    mesh_cols = [
        ("PASSIVE GEOLOCATION",
         "Indigenous NavIC (IRNSS)",
         "Dual-frequency L5 and S-band satellite receivers allow sub-meter coordinate fixes. Operates completely passively with ZERO SIM cards, zero mobile network, and zero cell-tower dependence.",
         "Precision: <1 meter • 100% Offline",
         CYAN_ACCENT),
        ("GROUND MESH RELAY",
         "Sub-GHz LoRa Ad-Hoc Nodes",
         "Utilizes 865–867 MHz license-free ISM band in India. Multi-hop peer-to-peer radio relay (5–15 km range per hop) carrying compressed citizen distress beacons and responder locations.",
         "Range: 5–15 km/hop • Multi-Hop P2P",
         GREEN_ACC),
        ("TACTICAL BACKHAUL",
         "NavIC SMS & VSAT Broadcast",
         "Leverages NavIC's short message service capability to broadcast verified evacuation vectors and emergency shelter notices directly from State Command to tactical field terminals.",
         "Direct Satellite Broadcast Downlink",
         ORANGE_ACC)
    ]

    card_w = Inches(3.7)
    gap = Inches(0.31)
    y_pos = Inches(1.5)
    for i, (tag, h, body, stat, col) in enumerate(mesh_cols):
        x = Inches(0.8) + i * (card_w + gap)
        c = s6.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x, y_pos, card_w, Inches(5.4))
        c.fill.solid()
        c.fill.fore_color.rgb = CARD_BG
        c.line.color.rgb = CARD_BORDER
        c.line.width = Pt(1)

        # Top strip
        top = s6.shapes.add_shape(MSO_SHAPE.RECTANGLE, x + Inches(0.15), y_pos + Inches(0.15), card_w - Inches(0.3), Inches(0.08))
        top.fill.solid()
        top.fill.fore_color.rgb = col
        top.line.fill.background()

        tf = c.text_frame
        tf.margin_left = tf.margin_right = Inches(0.25)
        tf.margin_top = Inches(0.4)
        tf.word_wrap = True

        p = tf.paragraphs[0]
        p.text = tag
        p.font.size = Pt(10)
        p.font.bold = True
        p.font.color.rgb = col

        p2 = tf.add_paragraph()
        p2.text = h
        p2.font.size = Pt(15)
        p2.font.bold = True
        p2.font.color.rgb = TEXT_WHITE
        p2.space_before = Pt(6)

        p3 = tf.add_paragraph()
        p3.text = body
        p3.font.size = Pt(11)
        p3.font.color.rgb = TEXT_MUTED
        p3.space_before = Pt(12)

        # Highlight Stat Box
        stat_box = s6.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x + Inches(0.25), y_pos + Inches(4.3), card_w - Inches(0.5), Inches(0.75))
        stat_box.fill.solid()
        stat_box.fill.fore_color.rgb = RGBColor(10, 18, 32)
        stat_box.line.color.rgb = col
        stat_box.line.width = Pt(1)
        tf_s = stat_box.text_frame
        tf_s.vertical_anchor = MSO_ANCHOR.MIDDLE
        p_s = tf_s.paragraphs[0]
        p_s.text = stat
        p_s.font.size = Pt(10)
        p_s.font.bold = True
        p_s.font.color.rgb = col
        p_s.alignment = PP_ALIGN.CENTER

    # ==========================================
    # SLIDE 7: TECHNOLOGIES & TOOLS USED
    # ==========================================
    s7 = prs.slides.add_slide(blank_layout)
    add_background(s7)
    add_header(s7, "06 / Technologies & Implementation", "Full-Stack Geospatial & Tactical Mesh Architecture")

    tech_quads = [
        ("CORE GEOAI & PROCESSING",
         "Python 3.12, GDAL, Rasterio, Shapely, GeoPandas",
         [
             "Automated STAC API query & scene downloading",
             "EOS-04/NISAR SAR backscatter thresholding (-16 dB water mask)",
             "Cartosat DEM hydrological runoff routing",
             "Raster-to-Vector compression (<100 KB GeoJSON packets)"
         ],
         CYAN_ACCENT),
        ("COMMAND CENTER WEB GIS",
         "React 19, TypeScript, Vite, Tailwind CSS, MapLibre GL",
         [
             "High-performance vector tile rendering",
             "MOSDAC precipitation heatmap overlay",
             "Bhuvan critical infrastructure triage layers",
             "Live dry evacuation corridor generator"
         ],
         INDIGO_ACC),
        ("OFFLINE FIELD RESPONDER PWA",
         "Progressive Web App, IndexedDB, Web APIs",
         [
             "Pre-cached vector tiles for offline disaster navigation",
             "Web Serial & Web Bluetooth bridge for LoRa radio nodes",
             "Simulated distress beacon broadcasting in airplane mode",
             "Real-time GPS / NavIC coordinate logging"
         ],
         GREEN_ACC),
        ("SECURITY & DEPLOYMENT",
         "Vercel Edge, Docker, Git Secret Auditing",
         [
             "Vercel Edge runtime for zero-cold-start GeoJSON delivery",
             "Zero leaked credentials (strict .env & 5-point audit check)",
             "Graceful offline mock fallbacks for live judge demo",
             "Fully production-built with TypeScript verification"
         ],
         ORANGE_ACC)
    ]

    card_w = Inches(5.7)
    card_h = Inches(2.55)
    xs = [Inches(0.8), Inches(6.833)]
    ys = [Inches(1.5), Inches(4.35)]

    for idx, (title, stack, bullets, col) in enumerate(tech_quads):
        x = xs[idx % 2]
        y = ys[idx // 2]
        c = s7.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x, y, card_w, card_h)
        c.fill.solid()
        c.fill.fore_color.rgb = CARD_BG
        c.line.color.rgb = CARD_BORDER
        c.line.width = Pt(1)

        tf = c.text_frame
        tf.margin_left = tf.margin_right = Inches(0.25)
        tf.margin_top = Inches(0.2)
        tf.word_wrap = True

        p = tf.paragraphs[0]
        p.text = title
        p.font.size = Pt(11)
        p.font.bold = True
        p.font.color.rgb = col

        p2 = tf.add_paragraph()
        p2.text = stack
        p2.font.size = Pt(10)
        p2.font.color.rgb = TEXT_WHITE
        p2.font.bold = True
        p2.space_before = Pt(2)

        for b in bullets:
            pb = tf.add_paragraph()
            pb.text = f"•  {b}"
            pb.font.size = Pt(9.5)
            pb.font.color.rgb = TEXT_MUTED
            pb.space_before = Pt(3)

    # ==========================================
    # SLIDE 8: WORKING PROTOTYPE DEMONSTRATION
    # ==========================================
    s8 = prs.slides.add_slide(blank_layout)
    add_background(s8)
    add_header(s8, "07 / Working Prototype Demonstration", "The 4-Step Operational Golden Path Shown to Judges")

    steps = [
        ("STEP 1", "MOSDAC Rain Alert",
         "MOSDAC GSMaP anomaly worker detects >15 mm/hr convective rainfall. Automated trigger instantly fires to query satellite SAR passes.",
         ORANGE_ACC),
        ("STEP 2", "SAR Water Extraction",
         "Bhoonidhi EOS-04 microwave radar penetrates cyclone clouds. Engine computes backscatter thresholding to delineate precise flood boundaries.",
         CYAN_ACCENT),
        ("STEP 3", "Evacuation Corridors",
         "VEDAS Cartosat DEM models surface runoff; classifies submerged roadways and computes safe dry evacuation paths to Bhuvan shelter locations.",
         INDIGO_ACC),
        ("STEP 4", "Offline Mesh Dispatch",
         "Hazard vector is distilled into a 48 KB packet, pushed over LoRa mesh to field responder PWAs operating in 100% airplane mode.",
         GREEN_ACC)
    ]

    card_w = Inches(2.75)
    gap = Inches(0.24)
    y_pos = Inches(1.5)

    for i, (step_num, title, desc, col) in enumerate(steps):
        x = Inches(0.8) + i * (card_w + gap)
        c = s8.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x, y_pos, card_w, Inches(4.3))
        c.fill.solid()
        c.fill.fore_color.rgb = CARD_BG
        c.line.color.rgb = CARD_BORDER
        c.line.width = Pt(1)

        # Circle badge for step
        circ = s8.shapes.add_shape(MSO_SHAPE.OVAL, x + Inches(0.2), y_pos + Inches(0.25), Inches(0.6), Inches(0.6))
        circ.fill.solid()
        circ.fill.fore_color.rgb = col
        circ.line.fill.background()
        tf_c = circ.text_frame
        tf_c.vertical_anchor = MSO_ANCHOR.MIDDLE
        p_c = tf_c.paragraphs[0]
        p_c.text = str(i+1)
        p_c.font.size = Pt(14)
        p_c.font.bold = True
        p_c.font.color.rgb = RGBColor(0, 0, 0) if col in [CYAN_ACCENT, GREEN_ACC] else TEXT_WHITE
        p_c.alignment = PP_ALIGN.CENTER

        tf = c.text_frame
        tf.margin_left = tf.margin_right = Inches(0.25)
        tf.margin_top = Inches(1.1)
        tf.word_wrap = True

        p = tf.paragraphs[0]
        p.text = step_num
        p.font.size = Pt(10)
        p.font.bold = True
        p.font.color.rgb = col

        p2 = tf.add_paragraph()
        p2.text = title
        p2.font.size = Pt(14)
        p2.font.bold = True
        p2.font.color.rgb = TEXT_WHITE
        p2.space_before = Pt(4)

        p3 = tf.add_paragraph()
        p3.text = desc
        p3.font.size = Pt(10.5)
        p3.font.color.rgb = TEXT_MUTED
        p3.space_before = Pt(10)

    # Demo Highlight Ribbon
    ribbon = s8.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), Inches(6.05), Inches(11.733), Inches(0.85))
    ribbon.fill.solid()
    ribbon.fill.fore_color.rgb = RGBColor(12, 28, 48)
    ribbon.line.color.rgb = CYAN_ACCENT
    ribbon.line.width = Pt(1)
    tf_r = ribbon.text_frame
    tf_r.vertical_anchor = MSO_ANCHOR.MIDDLE
    tf_r.margin_left = tf_r.margin_right = Inches(0.3)
    p_r = tf_r.paragraphs[0]
    p_r.text = "LIVE DEMO RESILIENCE: Built with instantaneous mock toggle fallback (USE_MOCK_DATA=true). If venue Wi-Fi drops during the 10:30 PM pitch or grand finale, the demo runs with zero latency."
    p_r.font.size = Pt(10.5)
    p_r.font.bold = True
    p_r.font.color.rgb = CYAN_ACCENT

    # ==========================================
    # SLIDE 9: IMPACT, FUTURE SCOPE & SCALABILITY
    # ==========================================
    s9 = prs.slides.add_slide(blank_layout)
    add_background(s9)
    add_header(s9, "08 / Impact, Future Scope & Scalability", "Beyond Disasters: Year-Round Multi-Sector Revenue")

    commercial_cards = [
        ("PARAMETRIC CROP INSURANCE",
         "Agri-DSS & PMFBY Automation",
         "Ingests VEDAS NDVI/phenology and MOSDAC soil moisture data to automate drought & flood verification for Pradhan Mantri Fasal Bima Yojana claims, reducing claim settlement from months to hours.",
         "Market: 55M+ Indian Farmers Insured",
         GREEN_ACC),
        ("WATER RESOURCE AUDITS",
         "Groundwater & Reservoir Monitoring",
         "Tracks reservoir depletion, groundwater recharge basins, and river interlinking channels using multi-temporal Bhuvan water body layers to guide State Irrigation Departments.",
         "Coverage: 50,000+ Major Water Bodies",
         CYAN_ACCENT),
        ("MUNICIPAL CLIMATE ZONING",
         "Urban Hazard & Infrastructure Risk",
         "Supplies smart cities, highway authorities (NHAI), and commercial real estate developers with historical flood inundation probability scores and disaster-resilient zoning maps.",
         "Clientele: Smart Cities & State Utilities",
         ORANGE_ACC)
    ]

    card_w = Inches(3.7)
    gap = Inches(0.31)
    y_pos = Inches(1.5)
    for i, (tag, h, body, metric, col) in enumerate(commercial_cards):
        x = Inches(0.8) + i * (card_w + gap)
        c = s9.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x, y_pos, card_w, Inches(5.4))
        c.fill.solid()
        c.fill.fore_color.rgb = CARD_BG
        c.line.color.rgb = CARD_BORDER
        c.line.width = Pt(1)

        top = s9.shapes.add_shape(MSO_SHAPE.RECTANGLE, x + Inches(0.15), y_pos + Inches(0.15), card_w - Inches(0.3), Inches(0.08))
        top.fill.solid()
        top.fill.fore_color.rgb = col
        top.line.fill.background()

        tf = c.text_frame
        tf.margin_left = tf.margin_right = Inches(0.25)
        tf.margin_top = Inches(0.4)
        tf.word_wrap = True

        p = tf.paragraphs[0]
        p.text = tag
        p.font.size = Pt(10)
        p.font.bold = True
        p.font.color.rgb = col

        p2 = tf.add_paragraph()
        p2.text = h
        p2.font.size = Pt(15)
        p2.font.bold = True
        p2.font.color.rgb = TEXT_WHITE
        p2.space_before = Pt(6)

        p3 = tf.add_paragraph()
        p3.text = body
        p3.font.size = Pt(11)
        p3.font.color.rgb = TEXT_MUTED
        p3.space_before = Pt(12)

        # Highlight metric box
        m_box = s9.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x + Inches(0.25), y_pos + Inches(4.3), card_w - Inches(0.5), Inches(0.75))
        m_box.fill.solid()
        m_box.fill.fore_color.rgb = RGBColor(10, 18, 32)
        m_box.line.color.rgb = col
        m_box.line.width = Pt(1)
        tf_m = m_box.text_frame
        tf_m.vertical_anchor = MSO_ANCHOR.MIDDLE
        p_m = tf_m.paragraphs[0]
        p_m.text = metric
        p_m.font.size = Pt(10)
        p_m.font.bold = True
        p_m.font.color.rgb = col
        p_m.alignment = PP_ALIGN.CENTER

    # ==========================================
    # SLIDE 10: EVALUATION MATRIX (WHY WE WIN)
    # ==========================================
    s10 = prs.slides.add_slide(blank_layout)
    add_background(s10)
    add_header(s10, "09 / Competitive Advantage & Rubric Alignment", "Why TerraPulse Wins ASTRA 2026: The Evaluation Matrix")

    # Table layout
    rows, cols = 4, 3
    left, top, width, height = Inches(0.8), Inches(1.5), Inches(11.733), Inches(5.3)
    table_shape = s10.shapes.add_table(rows, cols, left, top, width, height)
    table = table_shape.table
    table.columns[0].width = Inches(2.7)
    table.columns[1].width = Inches(4.2)
    table.columns[2].width = Inches(4.833)

    headers = ["JUDGING DIMENSION", "STANDARD COMPETITOR APPROACH", "THE TERRAPULSE ADVANTAGE"]
    for j, h in enumerate(headers):
        cell = table.cell(0, j)
        cell.fill.solid()
        cell.fill.fore_color.rgb = RGBColor(15, 23, 42)
        tf = cell.text_frame
        tf.margin_left = tf.margin_right = Inches(0.2)
        p = tf.paragraphs[0]
        p.text = h
        p.font.size = Pt(11)
        p.font.bold = True
        p.font.color.rgb = CYAN_ACCENT

    data = [
        ("Data Depth & Fusion\n(ISRO Priority)",
         "Uses single-source optical data (e.g. Sentinel-2) that fails completely under monsoon cloud cover. Zero multi-portal correlation.",
         "True Multi-Portal Fusion: Combines MOSDAC rain nowcasting, Bhoonidhi all-weather SAR, VEDAS GeoAI, and Bhuvan GIS infrastructure layers."),
        ("Operational Readiness\n(Space-to-Ground)",
         "Static web dashboard; stops at visual analytics with zero field connectivity or tactical delivery mechanism.",
         "End-to-End Last-Mile Delivery: Translates orbital data into offline NavIC / LoRa vector packets usable when 4G/5G mobile networks are dead."),
        ("National Alignment\n(Space Policy 2023)",
         "Generic open-source tools with zero indigenous policy or national space mission integration.",
         "Directly implements: Indian Space Policy 2023, National Geospatial Policy 2022, and indigenous NavIC dual-frequency positioning adoption.")
    ]

    for i, row in enumerate(data):
        cell_dim = table.cell(i+1, 0)
        cell_dim.fill.solid()
        cell_dim.fill.fore_color.rgb = RGBColor(12, 18, 34)
        tf = cell_dim.text_frame
        tf.margin_left = tf.margin_right = Inches(0.2)
        p = tf.paragraphs[0]
        p.text = row[0]
        p.font.size = Pt(11)
        p.font.bold = True
        p.font.color.rgb = TEXT_WHITE

        cell_comp = table.cell(i+1, 1)
        cell_comp.fill.solid()
        cell_comp.fill.fore_color.rgb = RGBColor(16, 20, 32)
        tf = cell_comp.text_frame
        tf.margin_left = tf.margin_right = Inches(0.2)
        p = tf.paragraphs[0]
        p.text = row[1]
        p.font.size = Pt(10)
        p.font.color.rgb = RGBColor(252, 165, 165)

        cell_tp = table.cell(i+1, 2)
        cell_tp.fill.solid()
        cell_tp.fill.fore_color.rgb = RGBColor(14, 28, 50)
        tf = cell_tp.text_frame
        tf.margin_left = tf.margin_right = Inches(0.2)
        p = tf.paragraphs[0]
        p.text = row[2]
        p.font.size = Pt(10)
        p.font.bold = True
        p.font.color.rgb = GREEN_ACC

    # ==========================================
    # SLIDE 11: CONCLUSION & DELIVERABLES STATUS
    # ==========================================
    s11 = prs.slides.add_slide(blank_layout)
    add_background(s11)
    add_header(s11, "10 / Grand Finale Summary", "TerraPulse: Ready to Launch")

    # Big Quote Box
    q_box = s11.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), Inches(1.5), Inches(11.733), Inches(1.6))
    q_box.fill.solid()
    q_box.fill.fore_color.rgb = RGBColor(15, 30, 52)
    q_box.line.color.rgb = CYAN_ACCENT
    q_box.line.width = Pt(1.5)
    tf = q_box.text_frame
    tf.margin_left = tf.margin_right = Inches(0.3)
    tf.margin_top = Inches(0.2)
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = "THE CORE TAKEAWAY:"
    p.font.size = Pt(11)
    p.font.bold = True
    p.font.color.rgb = CYAN_ACCENT
    p2 = tf.add_paragraph()
    p2.text = "\"When disasters strike, satellites watch from 500 km above. TerraPulse brings that orbital power straight to the rescue boat on the ground.\""
    p2.font.size = Pt(16)
    p2.font.bold = True
    p2.font.color.rgb = TEXT_WHITE
    p2.space_before = Pt(6)

    # 4 Deliverables Checklist Cards
    delivs = [
        ("01 / GITHUB REPO", "Complete project source code with clear setup & docs", GREEN_ACC),
        ("02 / PROJECT PPT", "Compulsory slide deck structured for 5–10 min judging", GREEN_ACC),
        ("03 / DEMO VIDEO", "1–2 minute recorded demonstration of the working solution", GREEN_ACC),
        ("04 / LIVE DEPLOYMENT", "Accessible production deployment of Web Command Center", GREEN_ACC)
    ]

    card_w = Inches(2.7)
    gap = Inches(0.3)
    y_pos = Inches(3.4)

    for i, (title, desc, col) in enumerate(delivs):
        x = Inches(0.8) + i * (card_w + gap)
        c = s11.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x, y_pos, card_w, Inches(2.2))
        c.fill.solid()
        c.fill.fore_color.rgb = CARD_BG
        c.line.color.rgb = CARD_BORDER
        c.line.width = Pt(1)

        tf = c.text_frame
        tf.margin_left = tf.margin_right = Inches(0.2)
        tf.margin_top = Inches(0.25)
        tf.word_wrap = True

        p = tf.paragraphs[0]
        p.text = title
        p.font.size = Pt(11)
        p.font.bold = True
        p.font.color.rgb = col

        p2 = tf.add_paragraph()
        p2.text = desc
        p2.font.size = Pt(10)
        p2.font.color.rgb = TEXT_MUTED
        p2.space_before = Pt(6)

        p3 = tf.add_paragraph()
        p3.text = "[ READY ]"
        p3.font.size = Pt(11)
        p3.font.bold = True
        p3.font.color.rgb = GREEN_ACC
        p3.space_before = Pt(10)

    # Bottom Contact Bar
    bot = s11.shapes.add_textbox(Inches(0.8), Inches(6.0), Inches(11.733), Inches(0.8))
    tf_b = bot.text_frame
    tf_b.word_wrap = True
    p = tf_b.paragraphs[0]
    p.text = "ASTRA 2026 • ANTERiX Club • VIT Bhopal University | Thank You! Questions & Discussion Welcome."
    p.font.size = Pt(11)
    p.font.color.rgb = TEXT_DIM
    p.alignment = PP_ALIGN.CENTER

    prs.save(output_path)
    print(f"Presentation successfully created at: {output_path}")

if __name__ == "__main__":
    create_deck("d:/Astra/TERRAPULSE_ASTRA_2026.pptx")
