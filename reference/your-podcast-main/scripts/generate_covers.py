"""Generate podcast cover images using Vertex AI Imagen 3."""

import os
import time
import vertexai
from vertexai.preview.vision_models import ImageGenerationModel

# Init Vertex AI
vertexai.init(
    project=os.environ.get("GOOGLE_CLOUD_PROJECT", "free-token-485920"),
    location=os.environ.get("GOOGLE_CLOUD_LOCATION", "us-central1"),
)

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend", "public", "covers")
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Podcast covers to generate - matching our mock data
COVERS = [
    ("gpt5", "Abstract digital brain with glowing neural networks, teal and cyan color palette, futuristic AI concept art, minimal clean design"),
    ("ai-strategy", "Geometric startup rocket launching through data streams, deep purple and violet, modern tech illustration, clean minimal"),
    ("rust-vs-go", "Two abstract geometric mascots facing each other, coral pink and warm red tones, programming language debate concept, minimal"),
    ("sleep-science", "Dreamy moon and brain waves visualization, deep orange and warm amber, neuroscience sleep concept, serene minimal art"),
    ("vision-pro", "Sleek VR headset floating in space with holographic UI elements, royal blue, Apple-style clean minimal design"),
    ("claude-coding", "AI robot hand typing on keyboard with code floating, burnt orange, pair programming concept, modern minimal"),
    ("death-podcasts", "Sound waveform transforming into digital particles, deep purple, audio evolution concept, minimal clean"),
    ("quantum", "Quantum particle entanglement visualization, teal green spheres connected by light, physics concept, minimal clean"),
    ("react-deep", "React logo dissolving into server components, blue and cyan, web development concept, clean geometric minimal"),
    ("topic-tech", "Circuit board pattern forming a lightbulb shape, teal green, technology innovation concept, minimal icon style"),
    ("topic-startups", "Rocket made of geometric shapes launching upward, purple, startup energy concept, minimal icon style"),
    ("topic-science", "DNA helix intertwined with stars, orange, science discovery concept, minimal icon style"),
    ("topic-programming", "Code brackets forming a diamond shape, royal blue, programming concept, minimal icon style"),
    ("topic-business", "Abstract chart growing into a tree, coral pink, business growth concept, minimal icon style"),
    ("topic-webdev", "Browser window with colorful code blocks, amber yellow, web development concept, minimal icon style"),
    ("avatar", "Friendly young tech professional portrait, warm neutral background, modern headshot style, photorealistic"),
]

model = ImageGenerationModel.from_pretrained("imagen-3.0-generate-002")

for i, (name, prompt) in enumerate(COVERS):
    output_path = os.path.join(OUTPUT_DIR, f"{name}.png")
    if os.path.exists(output_path):
        print(f"⏭️  Skipping {name} (already exists)")
        continue

    # Rate limit: wait between requests
    if i > 0:
        print("⏳ Waiting 15s for rate limit...")
        time.sleep(15)

    for attempt in range(3):
        print(f"🎨 Generating {name} (attempt {attempt + 1})...")
        try:
            response = model.generate_images(
                prompt=prompt,
                number_of_images=1,
                aspect_ratio="1:1",
            )
            response.images[0].save(output_path)
            print(f"✅ Saved {output_path}")
            break
        except Exception as e:
            if "429" in str(e) and attempt < 2:
                wait = 30 * (attempt + 1)
                print(f"⚠️  Rate limited, waiting {wait}s...")
                time.sleep(wait)
            else:
                print(f"❌ Failed {name}: {e}")
                break

print("\n🎉 Done! Generated covers in", OUTPUT_DIR)
