"""
Whiteboard explainer scene for The English Vault reels — matches the
"stick figure + boxes + arrows, white background, minimal color" style
of popular Hindi-language explainer Reels.

Fixed choreography (not LLM-generated code — arbitrary LLM-authored
Python would be a real code-execution risk; instead the LLM only fills
in TEXT content, same pattern as the carousel slide templates), with
per-beat timing padded to fit a target total duration passed in via
params.json, so it lines up with however long the real narration is.

Usage: manim -qh --output_file out.mp4 whiteboard_scene.py Explainer
       (reads params.json from the same directory, written by whiteboard.mjs)
"""

import json
import os
from manim import *

PARAMS_PATH = os.path.join(os.path.dirname(__file__), "params.json")

config.frame_width = 9
config.frame_height = 16
config.pixel_width = 1080
config.pixel_height = 1920


class StickFigure(VGroup):
    """A simple hand-built stick figure — Manim has no built-in one.
    `pose` selects a small set of arm positions for basic gesture variety."""

    def __init__(self, color=BLUE_E, height=2.2, pose="idle", **kwargs):
        super().__init__(**kwargs)
        r = height * 0.12
        head = Circle(radius=r, color=color, fill_opacity=1)
        head.shift(UP * (height * 0.5 - r))
        body_top = head.get_bottom()
        body_bottom = body_top + DOWN * height * 0.35
        body = Line(body_top, body_bottom, color=color, stroke_width=7)

        if pose == "explaining":
            arm_l = Line(body_top + DOWN * 0.1, body_top + UP * 0.15 + LEFT * 0.65, color=color, stroke_width=6)
            arm_r = Line(body_top + DOWN * 0.1, body_top + DOWN * 0.1 + RIGHT * 0.55 + DOWN * 0.2, color=color, stroke_width=6)
        elif pose == "waving":
            arm_l = Line(body_top + DOWN * 0.1, body_top + UP * 0.4 + LEFT * 0.4, color=color, stroke_width=6)
            arm_r = Line(body_top + DOWN * 0.1, body_top + DOWN * 0.1 + RIGHT * 0.5 + DOWN * 0.3, color=color, stroke_width=6)
        else:  # idle
            arm_l = Line(body_top + DOWN * 0.1, body_top + DOWN * 0.1 + LEFT * 0.5 + DOWN * 0.3, color=color, stroke_width=6)
            arm_r = Line(body_top + DOWN * 0.1, body_top + DOWN * 0.1 + RIGHT * 0.5 + DOWN * 0.3, color=color, stroke_width=6)

        leg_l = Line(body_bottom, body_bottom + LEFT * 0.4 + DOWN * 0.5, color=color, stroke_width=6)
        leg_r = Line(body_bottom, body_bottom + RIGHT * 0.4 + DOWN * 0.5, color=color, stroke_width=6)
        self.add(head, body, arm_l, arm_r, leg_l, leg_r)
        self.head = head


def speech_bubble(text, width=6.5, font_size=34, color=BLACK):
    box = RoundedRectangle(width=width, height=1.6, corner_radius=0.3, color=GRAY_D, fill_color=WHITE, fill_opacity=1)
    label = Text(text, font_size=font_size, color=color, weight=BOLD).move_to(box.get_center())
    if label.width > box.width - 0.6:
        label.scale_to_fit_width(box.width - 0.6)
    return VGroup(box, label)


class Explainer(Scene):
    def construct(self):
        self.camera.background_color = WHITE

        with open(PARAMS_PATH, "r", encoding="utf-8") as f:
            p = json.load(f)

        highlight = p.get("headlineHighlight", "")
        rest = p.get("headlineRest", "")
        body_lines = p.get("bodyLines", [])
        hindi = p.get("hindiSummary", "")
        handle = p.get("accountHandle", "@the_english__vault")
        primary = p.get("primaryColorHex", "#FF6B9D")
        secondary = p.get("secondaryColorHex", "#FFC75F")
        total_duration = float(p.get("targetTotalDuration", 20))

        # Fixed relative weights per beat; scaled to the real narration
        # length so pacing always matches however long the audio actually is.
        weights = {"intro": 0.18, "reveal": 0.22, "explain": 0.32, "hindi": 0.16, "cta": 0.12}
        beat_time = {k: total_duration * w for k, w in weights.items()}

        PRIMARY = ManimColor(primary)
        SECONDARY = ManimColor(secondary)

        # --- Beat 1: intro — stick figure + question bubble ---
        man = StickFigure(color=PRIMARY, pose="idle").shift(LEFT * 2.2 + DOWN * 1)
        bubble = speech_bubble(highlight or "?", color=BLACK).shift(RIGHT * 0.3 + UP * 2)
        t0 = self.time
        self.play(FadeIn(man, shift=UP * 0.3), run_time=0.5)
        self.play(Create(bubble[0]), FadeIn(bubble[1]), run_time=0.6)
        elapsed = self.time - t0
        self.wait(max(0.2, beat_time["intro"] - elapsed))
        self.play(FadeOut(bubble), run_time=0.4)

        # --- Beat 2: reveal — two-tone headline ---
        t0 = self.time
        h1 = Text(highlight, font_size=44, color=PRIMARY, weight=BOLD)
        h2 = Text(rest, font_size=34, color=BLACK).next_to(h1, DOWN, buff=0.3)
        headline = VGroup(h1, h2).move_to(UP * 2)
        if h1.width > 8:
            h1.scale_to_fit_width(8)
        if h2.width > 8:
            h2.scale_to_fit_width(8)
        self.play(Write(h1), run_time=0.7)
        self.play(FadeIn(h2, shift=UP * 0.2), run_time=0.5)
        self.play(man.animate.shift(UP * 0.1), rate_func=there_and_back, run_time=0.5)
        elapsed = self.time - t0
        self.wait(max(0.2, beat_time["reveal"] - elapsed))

        # --- Beat 3: explain — body text, line by line, explaining pose ---
        t0 = self.time
        man2 = StickFigure(color=PRIMARY, pose="explaining").move_to(man.get_center())
        self.remove(man)
        self.add(man2)
        man = man2

        body_group = VGroup()
        y = 0.3
        for line in body_lines[:3]:
            txt = Text(line, font_size=26, color=BLACK).shift(RIGHT * 0.3 + DOWN * y)
            if txt.width > 7.5:
                txt.scale_to_fit_width(7.5)
            body_group.add(txt)
            y += 0.7

        for line in body_group:
            self.play(FadeIn(line, shift=RIGHT * 0.15), run_time=0.5)
        elapsed = self.time - t0
        self.wait(max(0.2, beat_time["explain"] - elapsed))
        self.play(FadeOut(body_group), FadeOut(headline), run_time=0.4)

        # --- Beat 4: Hindi summary in a highlighted box ---
        t0 = self.time
        if hindi:
            hindi_box = RoundedRectangle(width=7.5, height=1.8, corner_radius=0.25, color=SECONDARY, fill_color=SECONDARY, fill_opacity=0.15)
            hindi_text = Text(hindi, font_size=30, color=BLACK, font="Noto Sans Devanagari").move_to(hindi_box.get_center())
            if hindi_text.width > hindi_box.width - 0.6:
                hindi_text.scale_to_fit_width(hindi_box.width - 0.6)
            hindi_group = VGroup(hindi_box, hindi_text).shift(UP * 1.5)
            self.play(Create(hindi_box), FadeIn(hindi_text), run_time=0.6)
            self.play(man.animate.shift(UP * 0.12), rate_func=there_and_back, run_time=0.5)
        elapsed = self.time - t0
        self.wait(max(0.2, beat_time["hindi"] - elapsed))
        if hindi:
            self.play(FadeOut(hindi_group), run_time=0.4)

        # --- Beat 5: CTA — waving figure ---
        t0 = self.time
        man3 = StickFigure(color=PRIMARY, pose="waving").move_to(man.get_center())
        self.remove(man)
        self.add(man3)
        cta = Text(f"Follow {handle}", font_size=32, color=SECONDARY, weight=BOLD).shift(UP * 2.2)
        if cta.width > 8:
            cta.scale_to_fit_width(8)
        self.play(FadeIn(cta, shift=UP * 0.2), run_time=0.5)
        self.play(man3.animate.shift(UP * 0.15), rate_func=there_and_back, run_time=0.4)
        elapsed = self.time - t0
        self.wait(max(0.2, beat_time["cta"] - elapsed))
