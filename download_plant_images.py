from icrawler.builtin import BingImageCrawler
from PIL import Image
import os
import random
import shutil

# ---------------------------
# CONFIGURATION
# ---------------------------
# EXISTING PLANTS (already downloaded)
existing_plants = [
    "aloe_barbadensis",
    "averrhoa_bilimbi",
    "blumea_balsamifera",
    "centella_asiatica",
    "coleus_scutellarioides",
    "corchorus_olitorius",
    "ehretia_microphylla",
    "euphorbia_hirta",
    "jatropha_curcas",
    "mangifera_indica",
    "manihot_esculenta",
    "mentha_cordifolia",
    "ocimum_basilicum",
    "origanum_vulgare",
    "pandanus_amaryllifolius",
    "peperomia_pellucida",
    "phyllanthus_niruri",
    "psidium_guajava",
    "senna_alata",
    "vitex_negundo"
]

# NEW PLANTS TO RE-DOWNLOAD
new_plants = [
    "moringa_oleifera",
    "momordica_charantia",
    "hibiscus_rosa_sinensis",
    "antidesma_bunius",
    "citrus_aurantiifolia"
]

# IMPROVED SEARCH QUERIES (more specific for better results)
improved_queries = {
    "moringa_oleifera": ["moringa oleifera leaves", "malunggay plant", "drumstick tree leaves"],
    "momordica_charantia": ["momordica charantia plant", "ampalaya leaves", "bitter gourd vine"],
    "hibiscus_rosa_sinensis": ["hibiscus rosa sinensis", "gumamela flower", "chinese hibiscus plant"],
    "antidesma_bunius": ["antidesma bunius fruit", "bignay tree", "bignay leaves"],
    "citrus_aurantiifolia": ["calamansi tree", "citrus aurantiifolia", "philippine lime plant"]
}

# ALL PLANTS (for splitting)
all_plants = existing_plants + new_plants

images_per_query = 50  # INCREASED from 30 to get more options
split_ratio = 0.8  # 80% train, 20% val

# ABSOLUTE PATHS ON PC (OneDrive/Documents)
raw_dir = r"C:\Users\Welzon Entera\OneDrive\Documents\Plantpal_dataset\raw_downloads"
train_dir = r"C:\Users\Welzon Entera\OneDrive\Documents\Plantpal_dataset\train"
val_dir = r"C:\Users\Welzon Entera\OneDrive\Documents\Plantpal_dataset\val"

os.makedirs(raw_dir, exist_ok=True)
os.makedirs(train_dir, exist_ok=True)
os.makedirs(val_dir, exist_ok=True)

# ---------------------------
# OPTION 1: DELETE OLD IMAGES FIRST
# ---------------------------
print("\n" + "="*60)
print("CLEANING UP OLD DOWNLOADS")
print("="*60)

for plant in new_plants:
    # Remove from raw_downloads
    plant_raw_path = os.path.join(raw_dir, plant)
    if os.path.exists(plant_raw_path):
        shutil.rmtree(plant_raw_path)
        print(f"✓ Deleted old raw images: {plant}")
    
    # Remove from train
    plant_train_path = os.path.join(train_dir, plant)
    if os.path.exists(plant_train_path):
        shutil.rmtree(plant_train_path)
        print(f"✓ Deleted old train images: {plant}")
    
    # Remove from val
    plant_val_path = os.path.join(val_dir, plant)
    if os.path.exists(plant_val_path):
        shutil.rmtree(plant_val_path)
        print(f"✓ Deleted old val images: {plant}")

# ---------------------------
# DOWNLOAD IMAGES WITH IMPROVED QUERIES
# ---------------------------
print("\n" + "="*60)
print("RE-DOWNLOADING WITH IMPROVED QUERIES")
print("="*60)
print(f"Plants to re-download: {len(new_plants)}")
print(f"Images per query: {images_per_query}\n")

for plant in new_plants:
    plant_raw_dir = os.path.join(raw_dir, plant)
    os.makedirs(plant_raw_dir, exist_ok=True)

    print(f"\n📥 Downloading: {plant}")
    
    # Use improved custom queries instead of generic ones
    queries = improved_queries.get(plant, [f"{plant} leaves", f"{plant} plant"])
    
    for query in queries:
        print(f"   Searching: {query}")

        crawler = BingImageCrawler(
            storage={"root_dir": plant_raw_dir},
            downloader_threads=4,  # Faster downloads
            parser_threads=4
        )
        try:
            crawler.crawl(
                keyword=query, 
                max_num=images_per_query,
                min_size=(200, 200),  # INCREASED minimum size for better quality
                file_idx_offset='auto'
            )
        except Exception as e:
            print(f"   ⚠️ Failed: {e}")

# ---------------------------
# CLEAN BROKEN IMAGES
# ---------------------------
print("\n" + "="*60)
print("CHECKING FOR BROKEN IMAGES")
print("="*60)

for plant in new_plants:
    plant_path = os.path.join(raw_dir, plant)
    if not os.path.exists(plant_path):
        continue
    
    removed_count = 0
    for root, _, files in os.walk(plant_path):
        for f in files:
            file_path = os.path.join(root, f)
            try:
                img = Image.open(file_path)
                img.verify()
            except:
                os.remove(file_path)
                removed_count += 1
    
    if removed_count > 0:
        print(f"✓ {plant}: Removed {removed_count} broken images")

# ---------------------------
# SPLIT INTO TRAIN / VAL
# ---------------------------
print("\n" + "="*60)
print("SPLITTING NEW PLANTS INTO TRAIN/VAL")
print("="*60)

for plant in new_plants:
    plant_raw_path = os.path.join(raw_dir, plant)
    if not os.path.exists(plant_raw_path):
        print(f"⚠️ {plant} folder missing, skipping split")
        continue

    # All images in one folder per plant
    images = [f for f in os.listdir(plant_raw_path)
              if f.lower().endswith(('.jpg', '.jpeg', '.png'))]

    if not images:
        print(f"⚠️ No images found for {plant}, skipping split")
        continue

    random.seed(42)
    random.shuffle(images)

    split_point = int(len(images) * split_ratio)
    train_images = images[:split_point]
    val_images = images[split_point:]

    # Create train/val folders
    plant_train_dir = os.path.join(train_dir, plant)
    plant_val_dir = os.path.join(val_dir, plant)
    os.makedirs(plant_train_dir, exist_ok=True)
    os.makedirs(plant_val_dir, exist_ok=True)

    # Copy images
    for img in train_images:
        shutil.copy2(os.path.join(plant_raw_path, img),
                     os.path.join(plant_train_dir, img))
    for img in val_images:
        shutil.copy2(os.path.join(plant_raw_path, img),
                     os.path.join(plant_val_dir, img))

    print(f"✓ {plant}: Total={len(images)} | Train={len(train_images)} | Val={len(val_images)}")

print("\n" + "="*60)
print("✅ RE-DOWNLOAD COMPLETE!")
print("="*60)
print(f"Total plant classes in dataset: {len(all_plants)}")
print(f"\nTrain folder: {train_dir}")
print(f"Val folder: {val_dir}")

print("\n" + "="*60)
print("IMPROVEMENTS MADE:")
print("="*60)
print("  • Deleted old low-quality images")
print("  • Used more specific search queries")
print("  • Increased images per query: 30 → 50")
print("  • Increased minimum image size: 100x100 → 200x200")
print("  • Added local plant names for better results")
print("\n💡 TIP: Check raw_downloads folder to manually review")
print("   images before they're split into train/val")
print("="*60)