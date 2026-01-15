import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader
from torchvision import datasets, transforms, models
import os
import json
import time
import numpy as np
from tqdm import tqdm

# ============================================================
# CONFIGURATION
# ============================================================
DATA_DIR = r"C:\Users\Welzon Entera\OneDrive\Documents\Plantpal_dataset"
TRAIN_DIR = os.path.join(DATA_DIR, "train")
VAL_DIR = os.path.join(DATA_DIR, "val")
OUTPUT_DIR = r"C:\Users\Welzon Entera\OneDrive\Documents\Plantpal_model"

# Training parameters
BATCH_SIZE = 16
NUM_EPOCHS = 30
LEARNING_RATE = 0.0005
IMG_SIZE = 224

os.makedirs(OUTPUT_DIR, exist_ok=True)

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"\n{'='*60}")
print(f"PLANTPAL MODEL TRAINING - 25 PLANT CLASSES")
print(f"{'='*60}")
print(f"Device: {device}")
print(f"PyTorch version: {torch.__version__}")

# ============================================================
# AGGRESSIVE DATA AUGMENTATION
# ============================================================
print("\n[1/6] Setting up AGGRESSIVE data transformations...")

train_transforms = transforms.Compose([
    transforms.Resize((IMG_SIZE + 32, IMG_SIZE + 32)),
    transforms.RandomResizedCrop(IMG_SIZE, scale=(0.6, 1.0), ratio=(0.8, 1.2)),
    transforms.RandomHorizontalFlip(p=0.5),
    transforms.RandomVerticalFlip(p=0.3),
    transforms.RandomRotation(degrees=30),
    transforms.RandomAffine(degrees=0, translate=(0.2, 0.2), scale=(0.8, 1.2), shear=10),
    transforms.RandomPerspective(distortion_scale=0.3, p=0.5),
    transforms.ColorJitter(brightness=0.3, contrast=0.3, saturation=0.3, hue=0.15),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    transforms.RandomErasing(p=0.3, scale=(0.02, 0.2)),
])

val_transforms = transforms.Compose([
    transforms.Resize((IMG_SIZE, IMG_SIZE)),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
])

# Load datasets
train_dataset = datasets.ImageFolder(TRAIN_DIR, transform=train_transforms)
val_dataset = datasets.ImageFolder(VAL_DIR, transform=val_transforms)

train_loader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=True, num_workers=0)
val_loader = DataLoader(val_dataset, batch_size=BATCH_SIZE, shuffle=False, num_workers=0)

class_names = train_dataset.classes
num_classes = len(class_names)

print(f"✓ Found {num_classes} plant classes:")

# Group existing and new plants
existing_plants = [
    "aloe_barbadensis", "averrhoa_bilimbi", "blumea_balsamifera",
    "centella_asiatica", "coleus_scutellarioides", "corchorus_olitorius",
    "ehretia_microphylla", "euphorbia_hirta", "jatropha_curcas",
    "mangifera_indica", "manihot_esculenta", "mentha_cordifolia",
    "ocimum_basilicum", "origanum_vulgare", "pandanus_amaryllifolius",
    "peperomia_pellucida", "phyllanthus_niruri", "psidium_guajava",
    "senna_alata", "vitex_negundo"
]

new_plants = [
    "moringa_oleifera", "momordica_charantia", "hibiscus_rosa_sinensis",
    "antidesma_bunius", "citrus_aurantiifolia"
]

print("\nEXISTING PLANTS (20):")
for i, name in enumerate(class_names):
    if name in existing_plants:
        train_count = len([x for x in train_dataset.samples if x[1] == i])
        val_count = len([x for x in val_dataset.samples if x[1] == i])
        print(f"  {i:2d}. {name:30s} | Train: {train_count:4d} | Val: {val_count:3d}")

print("\nNEW PLANTS (5):")
for i, name in enumerate(class_names):
    if name in new_plants:
        train_count = len([x for x in train_dataset.samples if x[1] == i])
        val_count = len([x for x in val_dataset.samples if x[1] == i])
        marker = "[OK]" if train_count > 0 else "[WARN]"
        print(f"  {marker} {i:2d}. {name:30s} | Train: {train_count:4d} | Val: {val_count:3d}")

total_train = len(train_dataset)
total_val = len(val_dataset)
print(f"\n{'='*60}")
print(f"DATASET SUMMARY:")
print(f"  Total Classes: {num_classes} (20 existing + 5 new)")
print(f"  Total Train Images: {total_train}")
print(f"  Total Val Images: {total_val}")
print(f"  Total Images: {total_train + total_val}")
print(f"{'='*60}")

# ============================================================
# IMPROVED MODEL WITH DROPOUT
# ============================================================
print("\n[2/6] Loading ResNet18 model with improvements...")

class ImprovedResNet18(nn.Module):
    def __init__(self, num_classes):
        super(ImprovedResNet18, self).__init__()
        self.resnet = models.resnet18(weights='IMAGENET1K_V1')
        
        # Unfreeze last 2 blocks for fine-tuning
        for name, param in self.resnet.named_parameters():
            if "layer4" in name or "layer3" in name:
                param.requires_grad = True
            else:
                param.requires_grad = False
        
        # Replace classifier with dropout
        num_features = self.resnet.fc.in_features
        self.resnet.fc = nn.Sequential(
            nn.Dropout(0.5),
            nn.Linear(num_features, num_classes)
        )
    
    def forward(self, x):
        return self.resnet(x)

model = ImprovedResNet18(num_classes).to(device)

print(f"✓ ResNet18 with dropout loaded")
print(f"✓ Output classes: {num_classes} (updated from 20 to 25)")
print(f"✓ Last 2 blocks (layer3, layer4) unfrozen")
print(f"✓ Dropout(0.5) added before final layer")

# ============================================================
# LOSS & OPTIMIZER WITH LABEL SMOOTHING
# ============================================================
print("\n[3/6] Setting up training with regularization...")

criterion = nn.CrossEntropyLoss(label_smoothing=0.1)
optimizer = optim.Adam(filter(lambda p: p.requires_grad, model.parameters()), lr=LEARNING_RATE)
scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode='max', patience=3, factor=0.5)

print(f"✓ Loss: CrossEntropyLoss with label_smoothing=0.1")
print(f"✓ Optimizer: Adam (lr={LEARNING_RATE})")
print(f"✓ Scheduler: ReduceLROnPlateau (patience=3)")

# ============================================================
# MIXUP AUGMENTATION
# ============================================================
def mixup_data(x, y, alpha=0.2):
    if alpha > 0:
        lam = np.random.beta(alpha, alpha)
    else:
        lam = 1
    
    batch_size = x.size()[0]
    index = torch.randperm(batch_size).to(x.device)
    
    mixed_x = lam * x + (1 - lam) * x[index, :]
    y_a, y_b = y, y[index]
    return mixed_x, y_a, y_b, lam

def mixup_criterion(criterion, pred, y_a, y_b, lam):
    return lam * criterion(pred, y_a) + (1 - lam) * criterion(pred, y_b)

# ============================================================
# TRAINING WITH PROGRESS BAR
# ============================================================
def train_epoch(model, loader, criterion, optimizer, device, epoch_num):
    model.train()
    running_loss = 0.0
    correct = 0
    total = 0
    
    pbar = tqdm(loader, desc=f"Epoch {epoch_num} [TRAIN]", 
                bar_format='{l_bar}{bar:30}{r_bar}',
                ncols=100)
    
    for inputs, labels in pbar:
        inputs, labels = inputs.to(device), labels.to(device)
        
        # Apply MixUp 50% of the time
        if np.random.random() > 0.5:
            inputs, targets_a, targets_b, lam = mixup_data(inputs, labels, alpha=0.2)
            optimizer.zero_grad()
            outputs = model(inputs)
            loss = mixup_criterion(criterion, outputs, targets_a, targets_b, lam)
            loss.backward()
            optimizer.step()
            
            running_loss += loss.item() * inputs.size(0)
            _, predicted = torch.max(outputs, 1)
            total += labels.size(0)
            correct += (lam * predicted.eq(targets_a).sum().float()
                        + (1 - lam) * predicted.eq(targets_b).sum().float()).item()
        else:
            optimizer.zero_grad()
            outputs = model(inputs)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()
            
            running_loss += loss.item() * inputs.size(0)
            _, predicted = torch.max(outputs, 1)
            total += labels.size(0)
            correct += (predicted == labels).sum().item()
        
        current_loss = running_loss / total
        current_acc = 100 * correct / total
        pbar.set_postfix({
            'loss': f'{current_loss:.4f}',
            'acc': f'{current_acc:.2f}%'
        })
    
    epoch_loss = running_loss / total
    epoch_acc = 100 * correct / total
    return epoch_loss, epoch_acc

# ============================================================
# VALIDATION WITH PROGRESS BAR
# ============================================================
def validate(model, loader, criterion, device, epoch_num):
    model.eval()
    running_loss = 0.0
    correct = 0
    total = 0
    
    pbar = tqdm(loader, desc=f"Epoch {epoch_num} [VAL]  ", 
                bar_format='{l_bar}{bar:30}{r_bar}',
                ncols=100)
    
    with torch.no_grad():
        for inputs, labels in pbar:
            inputs, labels = inputs.to(device), labels.to(device)
            outputs = model(inputs)
            loss = criterion(outputs, labels)
            
            running_loss += loss.item() * inputs.size(0)
            _, predicted = torch.max(outputs, 1)
            total += labels.size(0)
            correct += (predicted == labels).sum().item()
            
            current_loss = running_loss / total
            current_acc = 100 * correct / total
            pbar.set_postfix({
                'loss': f'{current_loss:.4f}',
                'acc': f'{current_acc:.2f}%'
            })
    
    epoch_loss = running_loss / total
    epoch_acc = 100 * correct / total
    return epoch_loss, epoch_acc

# ============================================================
# TRAINING LOOP
# ============================================================
print("\n[4/6] Starting training with 25 plant classes...")
print(f"{'='*60}\n")

best_val_acc = 0.0
training_history = []
start_time = time.time()

for epoch in range(NUM_EPOCHS):
    epoch_start = time.time()
    
    train_loss, train_acc = train_epoch(model, train_loader, criterion, optimizer, device, epoch+1)
    val_loss, val_acc = validate(model, val_loader, criterion, device, epoch+1)
    
    scheduler.step(val_acc)
    epoch_time = time.time() - epoch_start
    
    # Save best model
    if val_acc > best_val_acc:
        best_val_acc = val_acc
        torch.save({
            'epoch': epoch,
            'model_state_dict': model.state_dict(),
            'optimizer_state_dict': optimizer.state_dict(),
            'val_acc': val_acc,
            'class_names': class_names,
            'num_classes': num_classes
        }, os.path.join(OUTPUT_DIR, 'best_model.pth'))
        best_marker = " [NEW BEST]"
    else:
        best_marker = ""
    
    print(f"\n{'─'*60}")
    print(f"Epoch {epoch+1}/{NUM_EPOCHS} Summary ({epoch_time:.1f}s):")
    print(f"  Train Loss: {train_loss:.4f} | Train Acc: {train_acc:.2f}%")
    print(f"  Val Loss:   {val_loss:.4f} | Val Acc:   {val_acc:.2f}%{best_marker}")
    print(f"  Learning Rate: {optimizer.param_groups[0]['lr']:.6f}")
    print(f"{'─'*60}\n")
    
    training_history.append({
        'epoch': epoch + 1,
        'train_loss': train_loss,
        'train_acc': train_acc,
        'val_loss': val_loss,
        'val_acc': val_acc,
        'lr': optimizer.param_groups[0]['lr']
    })

total_time = time.time() - start_time

print(f"\n{'='*60}")
print(f"TRAINING COMPLETE")
print(f"{'='*60}")
print(f"Total training time: {total_time/60:.1f} minutes ({total_time/3600:.2f} hours)")
print(f"Best validation accuracy: {best_val_acc:.2f}%")
print(f"Average time per epoch: {total_time/NUM_EPOCHS:.1f}s")
print(f"{'='*60}\n")

# ============================================================
# SAVE MODELS
# ============================================================
print("[5/6] Saving model and metadata...")

torch.save({
    'model_state_dict': model.state_dict(),
    'class_names': class_names,
    'num_classes': num_classes,
    'best_val_acc': best_val_acc
}, os.path.join(OUTPUT_DIR, 'final_model.pth'))

with open(os.path.join(OUTPUT_DIR, 'class_names.json'), 'w') as f:
    json.dump(class_names, f, indent=2)

with open(os.path.join(OUTPUT_DIR, 'training_history.json'), 'w') as f:
    json.dump(training_history, f, indent=2)

model_info = {
    'model_architecture': 'ResNet18 (Enhanced)',
    'num_classes': num_classes,
    'class_names': class_names,
    'new_plants_added': new_plants,
    'image_size': IMG_SIZE,
    'best_val_accuracy': best_val_acc,
    'total_train_images': len(train_dataset),
    'total_val_images': len(val_dataset),
    'training_epochs': NUM_EPOCHS,
    'batch_size': BATCH_SIZE,
    'learning_rate': LEARNING_RATE,
    'total_training_time_minutes': total_time/60,
    'enhancements': [
        'Aggressive augmentation',
        'MixUp augmentation',
        'Label smoothing (0.1)',
        'Dropout (0.5)',
        'Fine-tuned layer3 + layer4',
        'ReduceLROnPlateau scheduler'
    ]
}

with open(os.path.join(OUTPUT_DIR, 'model_info.json'), 'w') as f:
    json.dump(model_info, f, indent=2)

print(f"✓ Models saved to: {OUTPUT_DIR}")
print(f"  ├─ best_model.pth ({best_val_acc:.2f}% val acc)")
print(f"  ├─ final_model.pth")
print(f"  ├─ class_names.json")
print(f"  ├─ training_history.json")
print(f"  └─ model_info.json")

# ============================================================
# FINAL REPORT
# ============================================================
print("\n[6/6] Final Report")
print(f"{'='*60}")
print(f"Model: Enhanced ResNet18")
print(f"Classes: {num_classes} (20 existing + 5 new)")
print(f"Best validation accuracy: {best_val_acc:.2f}%")
print(f"\nNEW PLANTS ADDED:")
print(f"  1. moringa_oleifera (Malunggay)")
print(f"  2. momordica_charantia (Ampalaya)")
print(f"  3. hibiscus_rosa_sinensis (Gumamela)")
print(f"  4. antidesma_bunius (Bignay)")
print(f"  5. citrus_aurantiifolia (Calamansi)")
print(f"\nEnhancements applied:")
print(f"  ✓ Aggressive data augmentation")
print(f"  ✓ MixUp augmentation")
print(f"  ✓ Label smoothing")
print(f"  ✓ Dropout regularization")
print(f"  ✓ Fine-tuned last 2 blocks")
print(f"\nTraining Progress:")

if len(training_history) >= 5:
    print(f"\n  Last 5 Epochs:")
    for h in training_history[-5:]:
        marker = "[BEST]" if h['val_acc'] == best_val_acc else "      "
        print(f"  {marker} Epoch {h['epoch']:2d}: Train {h['train_acc']:5.2f}% -> Val {h['val_acc']:5.2f}%")

print(f"\n{'='*60}")
print("\nMODEL READY WITH 25 PLANT CLASSES")
print("\nNext steps:")
print("  1. Test the model with all 25 plant species")
print("  2. Verify new plants are recognized correctly")
print("  3. Update Django backend with new class_names.json")
print("  4. Deploy updated model to production")
print(f"\n{'='*60}\n")