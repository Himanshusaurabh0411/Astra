#!/usr/bin/env python3
"""
TerraPulse Astra — 2-Minute Cinematic Hackathon Video Generator
Generates a 1080p MP4 presentation video with live app walkthroughs,
subtitles, Ken-Burns motion, HUD elements, and progress bars.
"""

import os
import sys
import time
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import imageio

# Video Specs
WIDTH = 1920
HEIGHT = 1080
FPS = 24
OUTPUT_FILE = "/Users/himanshusaurabh/Downloads/Astra Hackathon/terrapulse_hackathon_demo.mp4"
ARTIFACT_OUTPUT = "/Users/himanshusaurabh/.gemini/antigravity/brain/6256e759-6f47-4ea8-bb83-4c90bc6c7e0e/terrapulse_hackathon_demo.mp4"

# Fonts
try:
    FONT_TITLE = ImageFont.truetype("/System/Library/Fonts/HelveticaNeue.ttc", 28)
    FONT_BADGE = ImageFont.truetype("/System/Library/Fonts/HelveticaNeue.ttc", 16)
    FONT_SUBTITLE = ImageFont.truetype("/System/Library/Fonts/HelveticaNeue.ttc", 22)
    FONT_TIME = ImageFont.truetype("/System/Library/Fonts/HelveticaNeue.ttc", 18)
    FONT_HERO = ImageFont.truetype("/System/Library/Fonts/HelveticaNeue.ttc", 48)
    FONT_HERO_SUB = ImageFont.truetype("/System/Library/Fonts/HelveticaNeue.ttc", 24)
except Exception:
    FONT_TITLE = FONT_BADGE = FONT_SUBTITLE = FONT_TIME = FONT_HERO = FONT_HERO_SUB = ImageFont.load_default()

BASE_DIR = "/Users/himanshusaurabh/.gemini/antigravity/brain/6256e759-6f47-4ea8-bb83-4c90bc6c7e0e"

# Scenes configuration
SCENES = [
    {
        "id": "scene_1",
        "duration_sec": 16,
        "title": "SCENE 1: THE SILENT CRISIS",
        "action": "National Overview & The Hook",
        "narration": "Every monsoon, India faces devastating floods in Assam and deadly landslides in Wayanad. When cloudbursts hit, cell towers collapse—leaving rescue teams blind. TerraPulse solves this.",
        "image": f"{BASE_DIR}/terrapulse_submission_verified.png",
        "tag": "CRITICAL PROBLEM",
        "tag_color": (239, 68, 68),
    },
    {
        "id": "scene_2",
        "duration_sec": 20,
        "title": "SCENE 2: ASSAM BRAHMAPUTRA FLOOD INTELLIGENCE",
        "action": "⌘K Search 'Assam' · Sentinel-2 Multispectral & Cartosat DEM",
        "narration": "Search 'Assam'—zooming into Guwahati floodplains. Switch from Google Maps to Sentinel-2 satellite feed cutting through clouds, and Cartosat DEM revealing river danger marks.",
        "image": f"{BASE_DIR}/browser_evidence/9fe57cb3-7516-49f7-a3bd-e56828cb71d2/final_step_59.png",
        "tag": "LIVE ISRO FEED",
        "tag_color": (59, 130, 246),
    },
    {
        "id": "scene_3",
        "duration_sec": 20,
        "title": "SCENE 3: WAYANAD WESTERN GHATS & FARM STRESS",
        "action": "Elevation Contours · 48-Hour Agromet Harvest Planning",
        "narration": "Pivoting to Wayanad, Kerala: steep elevation contours highlight landslide drainage choke points. Farm Planner delivers 48-hour agromet advisories to protect farmers before roads submerge.",
        "image": f"{BASE_DIR}/browser_evidence/c8676b96-3e73-471f-a699-2c10573d34f9/final_step_36.png",
        "tag": "PREDICTIVE AGROMET",
        "tag_color": (16, 185, 129),
    },
    {
        "id": "scene_4",
        "duration_sec": 20,
        "title": "SCENE 4: THE 'AHA!' MOMENT — CELLULAR BLACKOUT",
        "action": "Simulate Heavy Rain >15mm/hr · Simulate Network Blackout",
        "narration": "Simulate Heavy Rain >15 mm/hr, then trigger Network Blackout. Cellular severed! Status flips to 'Offline Mesh'. Field responders open /field PWA with NavIC satellite lock.",
        "image": f"{BASE_DIR}/browser_evidence/6eff7dc7-55a1-4b26-b966-41bcb45ee3cb/final_step_61.png",
        "tag": "OFFLINE MESH ACTIVE",
        "tag_color": (245, 158, 11),
    },
    {
        "id": "scene_5",
        "duration_sec": 20,
        "title": "SCENE 5: LORA 865 MHz MESH & SAFE EVACUATION ROUTE",
        "action": "Peer-to-Peer Radio Relays · Deterministic Corridor Push",
        "narration": "Distress packets hop across 865 MHz LoRa mesh relays without internet. Command pushes 'Send Safe Route'—illuminating verified high-ground corridors directly to community shelters.",
        "image": f"{BASE_DIR}/browser_evidence/c8676b96-3e73-471f-a699-2c10573d34f9/final_step_51.png",
        "tag": "SAFE ROUTE DISPATCHED",
        "tag_color": (34, 197, 94),
    },
    {
        "id": "scene_6",
        "duration_sec": 20,
        "title": "SCENE 6: 4-PORTAL ISRO CASCADE & NDMA GOV PORTAL",
        "action": "MOSDAC + Bhoonidhi + VEDAS + Bhuvan · <100 KB Vector Payloads",
        "narration": "Powered by MOSDAC rain radar, Bhoonidhi SAR flood detection, VEDAS Cartosat DEM, and Bhuvan shelter triage. Zero hallucinations, <100 KB vector payloads, 85% faster rescue dispatch.",
        "image": f"{BASE_DIR}/browser_evidence/bcb578ee-2367-4b69-a481-fec1f294e000/final_step_43.png",
        "tag": "NDMA GOV PORTAL",
        "tag_color": (168, 85, 247),
    },
    {
        "id": "scene_7",
        "duration_sec": 14,
        "title": "SCENE 7: BUILDING A RESILIENT INDIA",
        "action": "Monitor · Analyse · Act · TerraPulse v1.0",
        "narration": "TerraPulse Astra bridges the fatal gap between orbiting satellites and citizens in rising waters. Monitor. Analyse. Act. Built for ISRO · TerraPulse v1.0.",
        "image": f"{BASE_DIR}/terrapulse_submission_verified.png",
        "tag": "WINNING VISION",
        "tag_color": (56, 189, 248),
    },
]

TOTAL_DURATION = sum(s["duration_sec"] for s in SCENES)
TOTAL_FRAMES = TOTAL_DURATION * FPS

print(f"Generating TerraPulse Astra Demo Video:")
print(f"Total Duration: {TOTAL_DURATION}s ({TOTAL_DURATION//60}:{TOTAL_DURATION%60:02d})")
print(f"Total Frames: {TOTAL_FRAMES} @ {FPS} fps | Resolution: {WIDTH}x{HEIGHT}")

# Pre-load and scale images
loaded_images = {}
for scene in SCENES:
    path = scene["image"]
    if path not in loaded_images:
        try:
            im = Image.open(path).convert("RGB")
            loaded_images[path] = im
        except Exception as e:
            print(f"Warning: could not load {path}: {e}")
            loaded_images[path] = Image.new("RGB", (1280, 800), (15, 23, 42))

def format_time(seconds):
    m = int(seconds) // 60
    s = int(seconds) % 60
    return f"{m}:{s:02d}"

# Open video writer
writer = imageio.get_writer(
    OUTPUT_FILE,
    fps=FPS,
    codec="libx264",
    pixelformat="yuv420p",
    macro_block_size=1,
)

current_time = 0.0
frame_count = 0
start_time = time.time()

# Background canvas template
base_bg = Image.new("RGB", (WIDTH, HEIGHT), (6, 12, 22))
draw_bg = ImageDraw.Draw(base_bg)
# Subtle grid
for x in range(0, WIDTH, 80):
    draw_bg.line([(x, 0), (x, HEIGHT)], fill=(12, 22, 38), width=1)
for y in range(0, HEIGHT, 80):
    draw_bg.line([(0, y), (WIDTH, y)], fill=(12, 22, 38), width=1)

for s_idx, scene in enumerate(SCENES):
    s_duration = scene["duration_sec"]
    s_frames = s_duration * FPS
    raw_img = loaded_images[scene["image"]]
    orig_w, orig_h = raw_img.size

    for f_idx in range(s_frames):
        # Progress calculations
        current_time += 1.0 / FPS
        frame_count += 1
        scene_pct = f_idx / max(1, s_frames - 1)
        total_pct = frame_count / TOTAL_FRAMES

        # Start with base background
        frame = base_bg.copy()
        draw = ImageDraw.Draw(frame)

        # 1. TOP HEADER BAR (Y: 20 to 80)
        # Emblem + Title
        draw.ellipse([(60, 32), (84, 56)], fill=(37, 99, 235))
        draw.ellipse([(65, 37), (79, 51)], fill=(16, 185, 129))
        draw.text((95, 30), "TerraPulse Astra", font=FONT_TITLE, fill=(255, 255, 255))
        draw.text((340, 36), "·  Space-to-Ground Disaster Intelligence", font=FONT_BADGE, fill=(148, 163, 184))

        # Scene Tag Pill
        tag_text = f" {scene['tag']} "
        draw.rounded_rectangle([(770, 32), (990, 58)], radius=6, fill=(15, 23, 42), outline=scene["tag_color"], width=1)
        draw.text((785, 36), scene["title"].split(":")[1].strip(), font=FONT_BADGE, fill=scene["tag_color"])

        # Status & Timecode
        draw.rounded_rectangle([(WIDTH - 320, 32), (WIDTH - 60, 58)], radius=6, fill=(15, 23, 42), outline=(51, 65, 85), width=1)
        draw.ellipse([(WIDTH - 305, 41), (WIDTH - 295, 51)], fill=(16, 185, 129))
        draw.text((WIDTH - 285, 36), f"● LIVE DEMO  |  {format_time(current_time)} / {format_time(TOTAL_DURATION)}", font=FONT_TIME, fill=(241, 245, 249))

        # 2. MAIN APP SCREENSHOT WINDOW (Y: 90 to 920, X: 60 to 1860)
        app_box_x = 60
        app_box_y = 80
        app_box_w = 1800
        app_box_h = 840

        # Ken Burns gentle zoom / pan
        zoom = 1.0 + 0.05 * scene_pct
        crop_w = int(orig_w / zoom)
        crop_h = int(orig_h / zoom)
        crop_x = int((orig_w - crop_w) * 0.5)
        crop_y = int((orig_h - crop_h) * 0.5)

        cropped = raw_img.crop((crop_x, crop_y, crop_x + crop_w, crop_y + crop_h))
        scaled = cropped.resize((app_box_w, app_box_h), Image.Resampling.LANCZOS)

        frame.paste(scaled, (app_box_x, app_box_y))
        # Glass window border
        draw.rounded_rectangle([(app_box_x, app_box_y), (app_box_x + app_box_w, app_box_y + app_box_h)], radius=8, outline=(51, 65, 85), width=2)

        # Action Watermark Badge inside Screenshot top-left
        draw.rounded_rectangle([(app_box_x + 16, app_box_y + 16), (app_box_x + 480, app_box_y + 48)], radius=6, fill=(11, 21, 36), outline=(56, 189, 248), width=1)
        draw.text((app_box_x + 28, app_box_y + 22), f"⚡ ACTION: {scene['action']}", font=FONT_BADGE, fill=(240, 249, 255))

        # 3. LOWER THIRD SUBTITLE & NARRATION BAR (Y: 935 to 1045)
        sub_x = 60
        sub_y = 935
        sub_w = 1800
        sub_h = 105

        draw.rounded_rectangle([(sub_x, sub_y), (sub_x + sub_w, sub_y + sub_h)], radius=10, fill=(11, 21, 36), outline=(37, 99, 235), width=1)
        # Glow bar accent on left
        draw.rectangle([(sub_x, sub_y), (sub_x + 6, sub_y + sub_h)], fill=(56, 189, 248))

        draw.text((sub_x + 24, sub_y + 14), f"🎙️ PRESENTER SCRIPT · {scene['title']}", font=FONT_BADGE, fill=(56, 189, 248))
        draw.text((sub_x + 24, sub_y + 42), f"\"{scene['narration']}\"", font=FONT_SUBTITLE, fill=(248, 250, 252))

        # 4. BOTTOM PROGRESS BAR (Y: 1060 to 1068)
        bar_y = 1062
        bar_h = 8
        draw.rectangle([(0, bar_y), (WIDTH, bar_y + bar_h)], fill=(15, 23, 42))
        prog_w = int(WIDTH * total_pct)
        if prog_w > 0:
            draw.rectangle([(0, bar_y), (prog_w, bar_y + bar_h)], fill=(56, 189, 248))

        # Write frame to video
        writer.append_data(np.array(frame))

        if frame_count % 120 == 0 or frame_count == TOTAL_FRAMES:
            elapsed = time.time() - start_time
            fps_speed = frame_count / max(0.1, elapsed)
            print(f"  Frame {frame_count}/{TOTAL_FRAMES} ({int(total_pct*100)}%) - {fps_speed:.1f} fps - {elapsed:.1f}s elapsed")

writer.close()

# Also copy to artifact path
try:
    import shutil
    shutil.copyfile(OUTPUT_FILE, ARTIFACT_OUTPUT)
    print(f"Copied to artifact: {ARTIFACT_OUTPUT}")
except Exception as e:
    print(f"Could not copy to artifact: {e}")

total_time = time.time() - start_time
file_size_mb = os.path.getsize(OUTPUT_FILE) / (1024 * 1024)
print(f"VIDEO GENERATED SUCCESSFULLY!")
print(f"Path: {OUTPUT_FILE}")
print(f"File Size: {file_size_mb:.2f} MB")
print(f"Total Render Time: {total_time:.2f}s")
