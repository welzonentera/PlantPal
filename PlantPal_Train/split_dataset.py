import os
import shutil
import random

# SET YOUR PATH HERE
SOURCE = r"C:\Users\Welzon Entera\OneDrive\Documents\Plantpal_dataset"
TRAIN = os.path.join(SOURCE, "train")
VAL = os.path.join(SOURCE, "val")

# Plants that are ALREADY split (don't touch these)
ALREADY_SPLIT = [
    "blumea_balsamifera",
    "coleus_scutellarioides",
    "mentha_cordifolia",
    "origanum_vulgare",
    "phyllanthus_niruri",
    "senna_alata",
    "vitex_negundo",
    # Add the 5 new plants here after they're split for the first time
    # "moringa_oleifera",
    # "momordica_charantia",
    # "hibiscus_rosa_sinensis",
    # "antidesma_bunius",
    # "citrus_aurantiifolia"
]

# 80% train, 20% validation
split_ratio = 0.8

# Get all plant folders
all_folders = [f for f in os.listdir(SOURCE) 
               if os.path.isdir(os.path.join(SOURCE, f)) 
               and f not in ["train", "val"]]

# Filter out already split plants
new_plants = [p for p in all_folders if p not in ALREADY_SPLIT]

print(f"Found {len(all_folders)} total plant classes")
print(f"Already split: {len(ALREADY_SPLIT)} plants")
print(f"NEW plants to split: {len(new_plants)} plants\n")

if not new_plants:
    print("⚠ No new plants to split!")
    print("All plants are already in the train/val folders.")
    exit()

print("NEW PLANTS TO BE SPLIT:")
for plant in new_plants:
    print(f"  - {plant}")

print("\n" + "="*50)
print("SPLITTING NEW PLANTS ONLY...")
print("="*50 + "\n")

# Split each NEW plant folder
for plant in new_plants:
    plant_path = os.path.join(SOURCE, plant)
    
    # Get all image files
    images = [f for f in os.listdir(plant_path) 
              if f.lower().endswith(('.jpg', '.jpeg', '.png', '.bmp'))]
    
    if not images:
        print(f"⚠ {plant}: No images found, skipping...")
        continue
    
    # Shuffle randomly
    random.seed(42)  # For reproducibility
    random.shuffle(images)
    
    # Calculate split point
    split_point = int(len(images) * split_ratio)
    train_images = images[:split_point]
    val_images = images[split_point:]
    
    # Create folders
    train_plant_dir = os.path.join(TRAIN, plant)
    val_plant_dir = os.path.join(VAL, plant)
    os.makedirs(train_plant_dir, exist_ok=True)
    os.makedirs(val_plant_dir, exist_ok=True)
    
    # Copy images to train
    for img in train_images:
        src = os.path.join(plant_path, img)
        dst = os.path.join(train_plant_dir, img)
        shutil.copy2(src, dst)
    
    # Copy images to val
    for img in val_images:
        src = os.path.join(plant_path, img)
        dst = os.path.join(val_plant_dir, img)
        shutil.copy2(src, dst)
    
    # Print results
    print(f"✓ {plant}:")
    print(f"    Total: {len(images)} | Train: {len(train_images)} | Val: {len(val_images)}")

print("\n" + "="*50)
print("SPLIT COMPLETE!")
print("="*50)
print(f"\nTotal classes in dataset: {len(ALREADY_SPLIT) + len(new_plants)}")
print(f"Train folder: {TRAIN}")
print(f"Val folder: {VAL}")

print("\n" + "="*50)
print("NEXT STEPS:")
print("="*50)
print("1. After verifying the split is correct, uncomment the 5 new plant names")
print("   in the ALREADY_SPLIT list to prevent re-splitting them in the future.")
print("2. You can now train your model with the updated dataset!")
print("3. Total plant classes: 12")