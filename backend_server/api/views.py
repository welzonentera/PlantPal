# ================================
# Django & DRF
# ================================
from django.conf import settings
from django.views.decorators.csrf import csrf_exempt
from django.utils import timezone

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

# ================================
# JWT / Authentication
# ================================
from rest_framework_simplejwt.tokens import RefreshToken, AccessToken
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import TokenError, InvalidToken
import jwt

# ================================
# Utilities
# ================================
from .utils import hash_password_sha256, verify_jwt_token

# ================================
# External Services
# ================================
from supabaseclient import supabase
import requests

# ================================
# Standard Library
# ================================
import json
import uuid
import random
import traceback
from datetime import datetime, timedelta
import base64
import io

# ================================
# Image Processing & ML
# ================================
from PIL import Image
import torch
from torchvision import transforms
# ================================
from .ml_service import plant_identifier
import logging

logger = logging.getLogger(__name__)

# --------------------------------------------------------------------
# Address search
# --------------------------------------------------------------------
@api_view(["GET"])
def search_address(request):
    query = request.GET.get("q", "")
    if not query:
        return Response({"error": "Missing query"}, status=400)

    url = "https://nominatim.openstreetmap.org/search"
    params = {
        "q": query,
        "format": "json",
        "addressdetails": 1,
        "limit": 5,
    }
    headers = {
        "User-Agent": "PlantPal/1.0 (barulotrishaanne@gmail.com)"
    }

    try:
        response = requests.get(url, params=params, headers=headers)
        response.raise_for_status()
        return Response(response.json())
    except requests.exceptions.RequestException as e:
        return Response({"error": str(e)}, status=500)

# --------------------------------------------------------------------
# Helper to generate unique usernames
# --------------------------------------------------------------------
def generate_username():
    plants = ["Fern", "Palm", "Rose", "Lily", "Orchid", "Ivy", "Moss", "Bamboo", "Cactus", "Daisy"]
    adjectives = ["Green", "Blooming", "Leafy", "Sunny", "Fresh", "Wild", "Tiny", "Majestic", "Bright"]
    return f"{random.choice(adjectives)}{random.choice(plants)}{random.randint(1000, 9999)}"

# --------------------------------------------------------------------
# Sign-up
# --------------------------------------------------------------------
@api_view(['POST'])
def signup(request):
    try:
        data = request.data
        email = data.get("email", "").strip().lower()
        password = data.get("password", "").strip()

        if not email or not password:
            return Response({"error": "Email and password required"},
                            status=status.HTTP_400_BAD_REQUEST)

        existing = (
            supabase.table("users")
            .select("user_email")
            .eq("user_email", email)
            .execute()
        )
        if existing.data:
            return Response({"error": "Email already exists"},
                            status=status.HTTP_400_BAD_REQUEST)

        hashed_password = hash_password_sha256(password)
        username = generate_username()
        
        while True:
            existing_username = (
                supabase.table("users")
                .select("user_name")
                .eq("user_name", username)
                .execute()
            )
            if not existing_username.data:
                break
            username = generate_username()

        user = (
            supabase.table("users")
            .insert({
                "user_email": email,
                "user_password": hashed_password,
                "user_name": username
            })
            .execute()
        )

        user_id = user.data[0]["id"]

        # ✅ FIXED: Create profile WITHOUT user_name
        supabase.table("profiles").insert({
            "user_id": user_id
        }).execute()

        # ✅ CREATE LOG & NOTIFICATION
        create_system_log(
            "INFO",
            f"New user registered: {username} ({email})",
            user_id=user_id
        )
        
        create_notification(
            "user_registered",
            "New User Account Created",
            f"New user {username} has registered with email {email}",
            user_id=user_id
        )

        return Response(
            {
                "message": "User signed up successfully!",
                "user": {"email": email, "username": username}
            },
            status=status.HTTP_201_CREATED
        )

    except Exception as e:
        # ✅ LOG ERRORS
        create_system_log("ERROR", f"Signup failed: {str(e)}")
        print(traceback.format_exc())
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# --------------------------------------------------------------------
# Login
# --------------------------------------------------------------------
from rest_framework_simplejwt.tokens import RefreshToken

@api_view(['POST'])
def login(request):
    try:
        email = request.data.get("email", "").strip().lower()
        password = request.data.get("password", "").strip()

        if not email or not password:
            return Response({"error": "Email and password required"},
                            status=status.HTTP_400_BAD_REQUEST)

        result = (
            supabase.table("users")
            .select("id, user_password, user_name")
            .eq("user_email", email)
            .single()
            .execute()
        )

        if not result.data:
            return Response({"error": "Invalid email or password"},
                            status=status.HTTP_401_UNAUTHORIZED)

        stored_hash = result.data["user_password"]
        if stored_hash != hash_password_sha256(password):
            return Response({"error": "Invalid email or password"},
                            status=status.HTTP_401_UNAUTHORIZED)

        # ✅ Create a proper user object with the Supabase user ID
        user_id = result.data["id"]
        
        # Create token with user_id as the identifier
        refresh = RefreshToken()
        refresh['user_id'] = user_id  # Use Supabase user ID
        refresh['email'] = email
        
        return Response(
            {
                "message": "Login successful!",
                "user": {
                    "id": user_id,
                    "email": email,
                    "username": result.data["user_name"]
                },
                "tokens": {
                    "refresh": str(refresh),
                    "access": str(refresh.access_token),
                }
            },
            status=status.HTTP_200_OK
        )

    except Exception as e:
        print(traceback.format_exc())
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([AllowAny])
def google_login(request):
    """
    Handle Google OAuth login
    Expects: email, google_id, name
    Returns: user data and JWT tokens
    """
    try:
        email = request.data.get('email', '').strip().lower()
        google_id = request.data.get('google_id', '').strip()
        name = request.data.get('name', '').strip()
        
        if not email or not google_id:
            return Response(
                {'error': 'Email and Google ID are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if user exists by email
        result = (
            supabase.table("users")
            .select("*")
            .eq("user_email", email)
            .execute()
        )
        
        if result.data and len(result.data) > 0:
            # User exists - get their info
            user = result.data[0]
            user_id = user["id"]
            username = user["user_name"]
            
            # Update google_id if not set (optional - requires google_id column)
            if "google_id" in user and not user.get("google_id"):
                supabase.table("users").update(
                    {"google_id": google_id}
                ).eq("user_email", email).execute()
        else:
            # Create new user for Google login
            # Generate unique username from email
            base_username = email.split('@')[0]
            username = base_username
            counter = 1
            
            # Ensure username is unique
            while True:
                check = supabase.table("users").select("id").eq("user_name", username).execute()
                if not check.data or len(check.data) == 0:
                    break
                username = f"{base_username}{counter}"
                counter += 1
            
            # Create new user
            # Note: user_password is required in your schema, so we use a placeholder
            new_user = (
                supabase.table("users")
                .insert({
                    "user_email": email,
                    "user_name": username,
                    "user_password": f"google_oauth_{google_id}",  # Placeholder
                    "google_id": google_id  # Only if you added this column
                })
                .execute()
            )
            
            if not new_user.data or len(new_user.data) == 0:
                return Response(
                    {'error': 'Failed to create user'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
            
            user = new_user.data[0]
            user_id = user["id"]
        
        # Generate JWT tokens (same as regular login)
        refresh = RefreshToken()
        refresh['user_id'] = user_id
        refresh['email'] = email
        
        return Response(
            {
                "message": "Google login successful!",
                "user": {
                    "id": user_id,
                    "email": email,
                    "username": username
                },
                "tokens": {
                    "refresh": str(refresh),
                    "access": str(refresh.access_token),
                }
            },
            status=status.HTTP_200_OK
        )
        
    except Exception as e:
        print(traceback.format_exc())
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

# --------------------------------------------------------------------
# Create profile (if you still want this separate)
# --------------------------------------------------------------------
@api_view(['POST'])
def create_profile(request):
    try:
        data = request.data
        email = data.get("email", "").strip().lower()
        address = data.get("address", "").strip()
        phone = data.get("phone", "").strip()
        bio = data.get("bio", "").strip()

        if not email:
            return Response({"error": "Email is required"},
                            status=status.HTTP_400_BAD_REQUEST)

        user_check = (
            supabase.table("users")
            .select("user_email")
            .eq("user_email", email)
            .execute()
        )

        if not user_check.data:
            return Response({"error": "User not found"},
                            status=status.HTTP_404_NOT_FOUND)

        profile = {
            "user_email": email,
            "address": address,
            "phone": phone,
            "bio": bio
        }

        supabase.table("profiles").insert(profile).execute()

        return Response({"message": "Profile created successfully!",
                         "profile": profile},
                        status=status.HTTP_201_CREATED)

    except Exception as e:
        print(traceback.format_exc())
        return Response({"error": str(e)},
                        status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# --------------------------------------------------------------------
# Fetch profile
# --------------------------------------------------------------------
@api_view(['GET'])
def profile(request):
    try:
        email = request.query_params.get("email", "").strip().lower()
        if not email:
            return Response({"error": "Email required"},
                            status=status.HTTP_400_BAD_REQUEST)

        # --- Get user ---
        user = (
            supabase.table("users")
            .select("id, user_email, user_name")
            .eq("user_email", email)
            .single()
            .execute()
        )

        if not user.data:
            return Response({"error": "User not found"},
                            status=status.HTTP_404_NOT_FOUND)

        # --- Get optional profile ---
        profile_result = (
            supabase.table("profiles")
            .select("city, interests, avatar_url, is_premium")
            .eq("user_id", user.data["id"])
            .maybe_single()
            .execute()
        )

        # ✅ Guard against None
        profile_data = profile_result.data if profile_result and profile_result.data else {}

        return Response(
            {
                "email": user.data["user_email"],
                "username": user.data["user_name"],
                "profile": profile_data
            },
            status=status.HTTP_200_OK
        )

    except Exception as e:
        print(traceback.format_exc())
        return Response({"error": str(e)},
                        status=status.HTTP_500_INTERNAL_SERVER_ERROR)
# --------------------------------------------------------------------
# Update profile & (optionally) username
# --------------------------------------------------------------------
@api_view(["PUT"])
def update_profile(request):
    """
    Updates a user's profile.
    Creates profile row if it does not exist.
    Updates users.user_name if provided.
    """
    try:
        email = request.data.get("email")
        updates = request.data.get("updates")

        # --- validation ---
        if not email:
            return Response(
                {"error": "Email is required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not isinstance(updates, dict):
            return Response(
                {"error": "`updates` must be an object"},
                status=status.HTTP_400_BAD_REQUEST
            )

        email = email.strip().lower()

        # --- find user ---
        user_res = (
            supabase.table("users")
            .select("id, user_name")
            .eq("user_email", email)
            .single()
            .execute()
        )

        if not user_res.data:
            return Response(
                {"error": "User not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        user_id = user_res.data["id"]

        # --- update username (if provided) ---
        if "user_name" in updates:
            new_username = updates.pop("user_name")

            if not new_username or not new_username.strip():
                return Response(
                    {"error": "Username cannot be empty"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            new_username = new_username.strip()

            # check if username is taken by ANOTHER user
            taken = (
                supabase.table("users")
                .select("id")
                .eq("user_name", new_username)
                .neq("id", user_id)
                .execute()
            )

            if taken.data:
                return Response(
                    {"error": "Username already taken"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            supabase.table("users") \
                .update({"user_name": new_username}) \
                .eq("id", user_id) \
                .execute()

        # --- upsert profile ---
        if updates:
            updates["updated_at"] = datetime.utcnow().isoformat()

            supabase.table("profiles").upsert(
                {
                    "user_id": user_id,
                    **updates
                },
                on_conflict=["user_id"]
            ).execute()

        return Response(
            {
                "message": "Profile updated successfully",
                "updates": updates
            },
            status=status.HTTP_200_OK
        )

    except Exception as e:
        print(traceback.format_exc())
        return Response(
            {"error": "Internal server error"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
@api_view(["POST"])
def subscribe_premium(request):
    email = request.data.get("email")

    if not email:
        return Response({"error": "Email is required"}, status=400)

    try:
        # 1️⃣ Get user
        user_resp = (
            supabase.table("users")
            .select("id")
            .eq("user_email", email.lower())
            .single()
            .execute()
        )

        if not user_resp.data:
            return Response({"error": "User not found"}, status=404)

        user_id = user_resp.data["id"]

        # 2️⃣ Update profile
        supabase.table("profiles").upsert(
            {
                "user_id": user_id,
                "is_premium": True,
                "updated_at": datetime.utcnow().isoformat(),
            },
            on_conflict=["user_id"],
        ).execute()

        # 3️⃣ Record payment
        supabase.table("subscription_payment_information").insert(
            {
                "user_id": user_id,
                "amount": 199.00,
                "currency": "PHP",
                "payment_status": "paid",
                "sub_status": "active",
                "payment_method": "mock",
            }
        ).execute()

        return Response({"message": "Premium activated"}, status=200)

    except Exception as e:
        return Response({"error": str(e)}, status=500)

# --------------------------------------------------------------------
# Admin Sign-up (for PlantPal Web)
# --------------------------------------------------------------------
@api_view(["POST"])
def admin_signup(request):
    try:
        data = request.data
        email = data.get("email", "").strip().lower()
        password = data.get("password", "").strip()
        user_name = data.get("user_name", "").strip()

        if not email or not password or not user_name:
            return Response(
                {"error": "Email, password, and username required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check if email already exists
        existing = (
            supabase.table("admin")
            .select("email")
            .eq("email", email)
            .execute()
        )
        if existing.data:
            return Response(
                {"error": "Email already exists"},
                status=status.HTTP_400_BAD_REQUEST
            )

        hashed_password = hash_password_sha256(password)

        # Insert new admin
        supabase.table("admin").insert({
            "email": email,
            "password": hashed_password,
            "user_name": user_name
        }).execute()

        return Response(
            {
                "message": "Admin signed up successfully!",
                "admin": {"email": email, "user_name": user_name}
            },
            status=status.HTTP_201_CREATED
        )

    except Exception as e:
        print(traceback.format_exc())
        return Response(
            {"error": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(["POST"])
@permission_classes([AllowAny])
def refresh_token(request):
    try:
        refresh_token = request.data.get("refresh")
        
        if not refresh_token:
            return Response({"error": "Refresh token required."}, status=400)
        
        # Validate and refresh the token
        refresh = RefreshToken(refresh_token)
        
        # Get the admin_id from the refresh token
        admin_id = refresh.get('admin_id')
        email = refresh.get('email')
        user_name = refresh.get('user_name')
        
        # Generate new access token with the same claims
        new_access = refresh.access_token
        new_access['admin_id'] = admin_id
        new_access['email'] = email
        new_access['user_name'] = user_name
        
        return Response({
            "access": str(new_access),
            "message": "Token refreshed successfully"
        }, status=200)
        
    except Exception as e:
        print(f"❌ Refresh token error: {e}")
        return Response({"error": "Invalid or expired refresh token."}, status=401)

@api_view(["POST"])
@permission_classes([AllowAny])
def admin_login(request):
    try:
        email = request.data.get("email", "").strip().lower()
        password = request.data.get("password", "").strip()

        if not email or not password:
            return Response({"error": "Email and password required."}, status=400)

        response = supabase.table("admin").select("*").eq("email", email).execute()
        admin_list = response.data
        if not admin_list:
            return Response({"error": "Invalid credentials."}, status=401)

        admin = admin_list[0]
        if hash_password_sha256(password) != admin["password"]:
            return Response({"error": "Invalid credentials."}, status=401)

        # 🔑 Generate JWT tokens with admin_id in payload
        refresh = RefreshToken()
        
        # ✅ Add custom claims to the token
        refresh['admin_id'] = admin['id']
        refresh['email'] = admin['email']
        refresh['user_name'] = admin['user_name']
        
        access_token = str(refresh.access_token)
        refresh_token = str(refresh)
                                                    
        admin_data = {
            "id": admin["id"],
            "email": admin["email"],
            "user_name": admin["user_name"],
            "created_at": admin["created_at"],
        }

        return Response({
            "message": "Login successful!",
            "admin": admin_data,
            "access": access_token,
            "refresh": refresh_token
        }, status=200)

    except Exception:
        print(traceback.format_exc())
        return Response({"error": "Internal server error."}, status=500)


# ============================================================================
# ✅ ADD PLANT (with normalized ailments)
# ============================================================================
@api_view(["POST"])
def add_plant(request):
    try:
        # Extract admin_id from JWT token
        auth_header = request.headers.get('Authorization', '')
        
        if not auth_header.startswith('Bearer '):
            return Response({"error": "No valid authorization header"}, status=401)
        
        token_string = auth_header.split(' ')[1]
        
        try:
            access_token = AccessToken(token_string)
            admin_id = access_token.get('admin_id')
            
            if not admin_id:
                return Response({"error": "Admin ID not found in token"}, status=401)
                
        except Exception as token_error:
            print(f"❌ Token error: {token_error}")
            return Response({"error": f"Invalid token: {str(token_error)}"}, status=401)

        # Extract plant data from form
        plant_name = request.data.get("plant_name")
        scientific_name = request.data.get("scientific_name")
        common_names_raw = request.data.get("common_names") or ""
        origin = request.data.get("origin")
        distribution = request.data.get("distribution")
        habitat = request.data.get("habitat")
        plant_type = request.data.get("plant_type")
        link = request.data.get("link")
        kingdom = request.data.get("kingdom")
        order = request.data.get("order")
        family = request.data.get("family")
        genus = request.data.get("genus")

        # Convert comma-separated common_names to PostgreSQL text[]
        common_names = (
            [name.strip() for name in common_names_raw.split(",") if name.strip()]
            if common_names_raw
            else None
        )

        # These are now stored per-ailment in plant_ailments table
        plant_data = {
            "plant_name": plant_name,
            "scientific_name": scientific_name,
            "common_names": common_names,
            "origin": origin,
            "distribution": distribution,
            "habitat": habitat,
            "plant_type": plant_type,
            "link": link,
            "kingdom": kingdom,
            "order": order,
            "family": family,
            "genus": genus,
            "admin_id": str(admin_id),
        }

        plant_insert = supabase.table("plants").insert(plant_data).execute()
        if not plant_insert.data:
            return Response({"error": "Failed to insert plant record."}, status=400)

        plant_id = plant_insert.data[0]["id"]

        ailments_raw = request.data.get("ailments", [])
        if ailments_raw:
            # Parse ailments if it's a JSON string
            if isinstance(ailments_raw, str):
                try:
                    ailments_raw = json.loads(ailments_raw)
                except json.JSONDecodeError:
                    ailments_raw = []
            
            # Insert each ailment with its reference and herbal benefit
            ailment_records = []
            if isinstance(ailments_raw, list):
                for ailment_item in ailments_raw:
                    if isinstance(ailment_item, dict):
                        ailment_records.append({
                            "plant_id": str(plant_id),
                            "ailment": ailment_item.get("ailment", ""),
                            "reference": ailment_item.get("reference", ""),
                            "herbal_benefit": ailment_item.get("herbalBenefit", ""),
                            "disease_type": ailment_item.get("diseaseType", ""),
                        })
            
            if ailment_records:
                supabase.table("plant_ailments").insert(ailment_records).execute()

        # Handle multiple plant image uploads
        uploaded_images = request.FILES.getlist("images")
        image_records = []

        if uploaded_images:
            for image in uploaded_images:
                try:
                    ext = image.name.split(".")[-1]
                    file_name = f"plants/{uuid.uuid4()}.{ext}"
                    supabase.storage.from_("plant-images").upload(file_name, image.read())
                    public_url = supabase.storage.from_("plant-images").get_public_url(file_name)
                    image_records.append({"plant_id": plant_id, "image_url": public_url})
                except Exception:
                    traceback.print_exc()
                    continue

            if image_records:
                supabase.table("plant_images").insert(image_records).execute()

        # Handle multiple leaf image uploads
        uploaded_leaf_images = request.FILES.getlist("leaf_images")
        leaf_records = []

        if uploaded_leaf_images:
            for leaf in uploaded_leaf_images:
                try:
                    ext = leaf.name.split(".")[-1]
                    file_name = f"leaves/{uuid.uuid4()}.{ext}"
                    supabase.storage.from_("plant-leaf-images").upload(file_name, leaf.read())
                    public_url = supabase.storage.from_("plant-leaf-images").get_public_url(file_name)
                    leaf_records.append({"plant_id": plant_id, "leaf_image_url": public_url})
                except Exception:
                    traceback.print_exc()
                    continue

            if leaf_records:
                supabase.table("plant_leaves").insert(leaf_records).execute()

        return Response(
            {"message": "✅ Plant and ailments added successfully!", "plant_id": str(plant_id)},
            status=status.HTTP_201_CREATED,
        )

    except Exception as e:
        print("⚠️ Error in add_plant:", traceback.format_exc())
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ============================================================================
# ✅ GET PLANTS (with ailments grouped by disease type)
# ============================================================================
@api_view(["GET"])
def get_plants(request):
    try:
        response = (
            supabase.table("plants")
            .select("*")
            .order("created_at", desc=True)
            .execute()
        )
        plants = response.data or []

        for plant in plants:
            plant_id = plant["id"]

            # Fetch ALL plant images
            plant_images_resp = (
                supabase.table("plant_images")
                .select("image_url")
                .eq("plant_id", plant_id)
                .execute()
            )
            plant["images"] = [img["image_url"] for img in plant_images_resp.data]
            plant["image"] = plant["images"][0] if plant["images"] else None

            ailments_resp = (
                supabase.table("plant_ailments")
                .select("*")
                .eq("plant_id", plant_id)
                .execute()
            )
            
            ailments = ailments_resp.data or []
            
            # Group ailments by disease_type
            ailments_by_disease = {}
            for ailment in ailments:
                disease_type = ailment.get("disease_type", "Other")
                if disease_type not in ailments_by_disease:
                    ailments_by_disease[disease_type] = []
                
                ailments_by_disease[disease_type].append({
                    "ailment": ailment.get("ailment"),
                    "reference": ailment.get("reference"),
                    "herbalBenefit": ailment.get("herbal_benefit"),
                })
            
            plant["ailments"] = ailments_by_disease
            plant["ailmentsList"] = ailments  # Also provide flat list if needed

        return Response(plants, status=200)

    except Exception as e:
        print("❌ Error fetching plants:", traceback.format_exc())
        return Response({"error": str(e)}, status=500)
    
# =====================================================================
# ✅ SEARCH PLANTS (via Supabase, with partial match on name/scientific_name)
# =====================================================================
@api_view(["GET"])
def search_plants(request):
    try:
        query = request.GET.get("q", "").strip()
        if not query:
            return Response({"error": "Missing search query"}, status=400)

        # Search in plant_name and scientific_name fields
        response = (
            supabase.table("plants")
            .select("*")
            .or_(f"plant_name.ilike.%{query}%,scientific_name.ilike.%{query}%")
            .execute()
        )

        plants = response.data or []

        # Fetch related images for each plant
        for plant in plants:
            plant_id = plant["id"]
            images_resp = (
                supabase.table("plant_images")
                .select("image_url")
                .eq("plant_id", plant_id)
                .execute()
            )
            plant["images"] = [img["image_url"] for img in images_resp.data]
            plant["image"] = plant["images"][0] if plant["images"] else None

        return Response(plants, status=200)

    except Exception as e:
        print("❌ Error in search_plants:", traceback.format_exc())
        return Response({"error": str(e)}, status=500)


# =====================================================================
# ✅ GET SEARCH HISTORY (from Supabase, by user email)
# =====================================================================
@api_view(["GET"])
def get_search_history(request):
    try:
        email = request.GET.get("email", "").strip().lower()
        if not email:
            return Response({"error": "Email required"}, status=400)

        response = (
            supabase.table("search_history")
            .select("query, timestamp")
            .eq("user_email", email)
            .order("timestamp", desc=True)
            .limit(10)
            .execute()
        )

        history = response.data or []
        return Response(history, status=200)

    except Exception as e:
        print("⚠️ Error in get_search_history:", traceback.format_exc())
        return Response({"error": str(e)}, status=500)
    
# ============================================================================
# ✅ UPDATE PLANT (with normalized ailments)
# ============================================================================
@api_view(["PATCH"])
def update_plant(request, plant_id):
    try:
        plant_id_str = str(plant_id)
        
        # Extract admin_id from JWT token
        auth_header = request.headers.get('Authorization', '')
        
        if not auth_header.startswith('Bearer '):
            return Response({"error": "No valid authorization header"}, status=401)
        
        token_string = auth_header.split(' ')[1]
        
        try:
            access_token = AccessToken(token_string)
            admin_id = access_token.get('admin_id')
            
            if not admin_id:
                return Response({"error": "Admin ID not found in token"}, status=401)
                
        except Exception as token_error:
            print(f"❌ Token error: {token_error}")
            return Response({"error": f"Invalid token: {str(token_error)}"}, status=401)

        allowed_fields = [
            "plant_name", "scientific_name", "common_names", "origin",
            "distribution", "habitat", "plant_type", "link", "kingdom", 
            "order", "family", "genus"
        ]

        update_data = {}

        for field in allowed_fields:
            if field in request.data:
                update_data[field] = request.data.get(field)

        # Handle common_names
        if "common_names" in update_data and isinstance(update_data["common_names"], str):
            update_data["common_names"] = [
                n.strip() for n in update_data["common_names"].split(",") if n.strip()
            ]

        if not update_data and "deleted_images" not in request.data and not request.FILES.getlist("images"):
            return Response({"error": "No fields to update."}, status=400)

        # Update plant fields
        if update_data:
            response = (
                supabase.table("plants")
                .update(update_data)
                .eq("id", plant_id_str)
                .execute()
            )
            if not response.data:
                return Response({"error": "Plant not found or update failed."}, status=404)

        ailments_raw = request.data.get("ailments")
        if ailments_raw is not None:
            # Delete old ailments
            supabase.table("plant_ailments").delete().eq("plant_id", plant_id_str).execute()
            
            # Parse ailments if it's a JSON string
            if isinstance(ailments_raw, str):
                try:
                    ailments_raw = json.loads(ailments_raw)
                except json.JSONDecodeError:
                    ailments_raw = []
            
            # Insert new ailments
            ailment_records = []
            if isinstance(ailments_raw, list):
                for ailment_item in ailments_raw:
                    if isinstance(ailment_item, dict):
                        ailment_records.append({
                            "plant_id": plant_id_str,
                            "ailment": ailment_item.get("ailment", ""),
                            "reference": ailment_item.get("reference", ""),
                            "herbal_benefit": ailment_item.get("herbalBenefit", ""),
                            "disease_type": ailment_item.get("diseaseType", ""),
                        })
            
            if ailment_records:
                supabase.table("plant_ailments").insert(ailment_records).execute()

        # Handle deleted images
        deleted_images = request.data.get("deleted_images")
        if deleted_images:
            try:
                deleted_images = json.loads(deleted_images)
                for url in deleted_images:
                    file_path = url.split("/plant-images/")[-1]
                    supabase.storage.from_("plant-images").remove([file_path])
                    supabase.table("plant_images").delete().eq("image_url", url).execute()
            except Exception as e:
                print("⚠️ Failed to delete image:", e)

        # Handle newly uploaded images
        new_images = request.FILES.getlist("images")
        for image in new_images:
            try:
                file_path = f"{str(uuid.uuid4())}_{image.name}"
                supabase.storage.from_("plant-images").upload(file_path, image.read())
                public_url = supabase.storage.from_("plant-images").get_public_url(file_path)
                supabase.table("plant_images").insert({"plant_id": plant_id_str, "image_url": public_url}).execute()
            except Exception as e:
                print("⚠️ Failed to upload image:", e)

        return Response({"message": "✅ Plant updated successfully!"}, status=200)

    except Exception as e:
        print("⚠️ Error updating plant:", traceback.format_exc())
        return Response({"error": str(e)}, status=500)


# ============================================================================
# ✅ DELETE PLANT (with cascade delete for ailments)
# ============================================================================
@api_view(["DELETE"])
def delete_plant(request, plant_id):
    try:
        plant_id_str = str(plant_id)
        
        # Get plant record
        plant_response = supabase.table("plants").select("*").eq("id", plant_id_str).execute()
        if not plant_response.data:
            return Response({"error": "Plant not found."}, status=404)

        supabase.table("plant_ailments").delete().eq("plant_id", plant_id_str).execute()

        # Delete plant images from storage
        images_response = supabase.table("plant_images").select("image_url").eq("plant_id", plant_id_str).execute()
        images = images_response.data or []

        for img in images:
            try:
                file_path = img["image_url"].split("/plant-images/")[-1]
                supabase.storage.from_("plant-images").remove([file_path])
            except Exception as e:
                print("⚠️ Failed to delete image:", e)

        # Delete plant images records from DB
        supabase.table("plant_images").delete().eq("plant_id", plant_id_str).execute()

        # Delete the plant itself
        supabase.table("plants").delete().eq("id", plant_id_str).execute()

        return Response({"message": "✅ Plant deleted successfully!"}, status=200)

    except Exception as e:
        print("⚠️ Error deleting plant:", traceback.format_exc())
        return Response({"error": str(e)}, status=500)

#terms and conditions for admin   
@api_view(['POST'])
def add_terms_conditions(request):
    """
    Admin: Add a new Terms and Conditions version
    """
    try:
        data = request.data
        version = data.get("version")
        content = data.get("content")
        effective_date = data.get("effective_date")

        if not version or not content or not effective_date:
            return Response({"error": "version, content, and effective_date are required"},
                            status=status.HTTP_400_BAD_REQUEST)

        # Deactivate all currently active versions
        supabase.table("terms_conditions").update({"is_active": False}).eq("is_active", True).execute()

        # Insert the new active version
        new_terms = (
            supabase.table("terms_conditions")
            .insert({
                "version": version,
                "content": content,
                "effective_date": effective_date,
                "is_active": True
            })
            .execute()
        )

        return Response({
            "message": "New terms and conditions version added successfully!",
            "terms": new_terms.data[0]
        }, status=status.HTTP_201_CREATED)

    except Exception as e:
        print(traceback.format_exc())
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

#for the user terms and conditions   
@api_view(['POST'])
def accept_terms_conditions(request):
    """
    User: Accept current Terms and Conditions
    """
    try:
        data = request.data
        user_id = data.get("user_id")
        terms_id = data.get("terms_id")

        if not user_id or not terms_id:
            return Response({"error": "user_id and terms_id are required"},
                            status=status.HTTP_400_BAD_REQUEST)

        # Check if already accepted
        existing = (
            supabase.table("user_acceptance")
            .select("*")
            .eq("user_id", user_id)
            .eq("terms_id", terms_id)
            .execute()
        )
        if existing.data:
            return Response({"message": "User already accepted this version."},
                            status=status.HTTP_200_OK)

        # Insert new acceptance record
        acceptance = (
            supabase.table("user_acceptance")
            .insert({
                "user_id": user_id,
                "terms_id": terms_id
            })
            .execute()
        )

        return Response({
            "message": "Terms and Conditions accepted successfully!",
            "acceptance": acceptance.data[0]
        }, status=status.HTTP_201_CREATED)

    except Exception as e:
        print(traceback.format_exc())
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    

# ✅ Get all Terms & Conditions versions (for admin dashboard)
@api_view(['GET'])
def get_terms_conditions(request):
    """
    Admin: Fetch all Terms and Conditions versions
    """
    try:
        # Fetch all versions sorted by date (newest first)
        response = (
            supabase.table("terms_conditions")
            .select("*")
            .order("effective_date", desc=True)
            .execute()
        )

        if not response.data:
            return Response([], status=status.HTTP_200_OK)

        return Response(response.data, status=status.HTTP_200_OK)

    except Exception as e:
        print(traceback.format_exc())
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(["PUT"])
def update_admin_profile(request):
    try:
        admin_id = request.data.get("id")
        if not admin_id:
            return Response({"error": "Admin ID is required"}, status=400)

        email = request.data.get("email", "").strip().lower()
        user_name = request.data.get("user_name", "").strip()
        current_password = request.data.get("current_password", "").strip()
        new_password = request.data.get("new_password", "").strip()

        response = supabase.table("admin").select("*").eq("id", admin_id).execute()
        admins = response.data
        if not admins:
            return Response({"error": "Admin not found"}, status=404)

        admin = admins[0]

        # verify current password if provided
        if current_password and hash_password_sha256(current_password) != admin["password"]:
            return Response({"error": "Incorrect current password"}, status=400)

        updates = {}
        if user_name and user_name != admin["user_name"]:
            updates["user_name"] = user_name
        if email and email != admin["email"]:
            updates["email"] = email

        if new_password:
            if not current_password:
                return Response({"error": "Current password is required to change password"}, status=400)
            updates["password"] = hash_password_sha256(new_password)

        if not updates:
            return Response({"message": "No changes detected"}, status=200)

        supabase.table("admin").update(updates).eq("id", admin["id"]).execute()

        return Response({"message": "Profile updated successfully!", "admin": {**admin, **updates}}, status=200)

    except Exception as e:
        import traceback
        print(traceback.format_exc())
        return Response({"error": str(e)}, status=500)


# GET USERS (for Admin Dashboard, no JWT required for testing)
# --------------------------------------------------------------------
@api_view(["GET"])
@permission_classes([AllowAny])
def get_users(request):
    """
    Fetch all registered users with their profile information from Supabase.
    """
    try:
        print("Fetching users with profiles from Supabase...")

        # Join users table with profiles table
        response = supabase.table("users").select(
            "id, user_name, user_email, created_at, profiles(city, avatar_url, is_premium)"
        ).execute()

        users = response.data

        if users is None:
            return Response([], status=200)

        # Map keys for frontend with profile data
        formatted_users = []
        for u in users:
            # profiles is a dictionary or None (since it's a 1-to-1 relationship)
            profile = u.get("profiles")
            
            user_data = {
                "id": u.get("id"),
                "full_name": u.get("user_name", "Unknown"),
                "email": u.get("user_email", ""),
                "date_joined": u.get("created_at", ""),
                "user_name": u.get("user_name", "Unknown"),
                "user_email": u.get("user_email", ""),
                "city": None,
                "avatar_url": None,
                "is_premium": False,
            }
            
            # Extract profile data if it exists
            if profile and isinstance(profile, dict):
                user_data["city"] = profile.get("city")
                user_data["avatar_url"] = profile.get("avatar_url")
                user_data["is_premium"] = profile.get("is_premium", False)
            
            formatted_users.append(user_data)

        print(f"Returning {len(formatted_users)} users with profile data")
        return Response(formatted_users, status=200)

    except Exception as e:
        import traceback
        print("❌ Exception in get_users:", traceback.format_exc())
        return Response({"error": f"Server error: {str(e)}"}, status=500)
    

@api_view(["DELETE"])
@permission_classes([AllowAny])  # replace with custom admin check later
def delete_user(request, user_id):
    try:
        # Define the order of deletion (child tables first, then parent)
        # Based on your table list and likely foreign key relationships
        related_tables = [
            "admin_notifications",    # UNRESTRICTED
            "search_history",         # UNRESTRICTED
            "system_logs",            # UNRESTRICTED
            "scan_history",           # Likely references users
            "journal",                # Likely references users
            "user_acceptance",        # Likely references users
            "profiles",               # References users
            "subscription_payment_information",  # Likely references users
            # Note: plant_aliments, plant_images, plants might reference users
            # if users can own plants, add them too
        ]
        
        # First, delete from all related tables
        for table in related_tables:
            try:
                # Try to delete where user_id matches
                supabase.table(table).delete().eq("user_id", user_id).execute()
                print(f"✓ Deleted from {table}")
            except Exception as table_error:
                # Some tables might use different column names
                # Try common variations
                try:
                    supabase.table(table).delete().eq("user", user_id).execute()
                except:
                    try:
                        supabase.table(table).delete().eq("user_id", user_id).execute()
                    except:
                        # Table might not have user reference or uses different column
                        print(f"⚠ Could not delete from {table}: {table_error}")
                        continue
        
        # Now delete the user
        response = supabase.table("users").delete().eq("id", user_id).execute()

        # Supabase response handling
        if hasattr(response, "error") and response.error:
            return Response({"error": f"Supabase error: {response.error}"}, status=500)

        if not response.data or len(response.data) == 0:
            return Response({"error": "User not found"}, status=404)

        return Response({"message": "User deleted successfully"}, status=200)

    except Exception as e:
        import traceback
        print("❌ Exception in delete_user:", traceback.format_exc())
        return Response({"error": f"Server error: {str(e)}"}, status=500)

@api_view(['GET'])
def get_latest_terms_conditions(request):
    try:
        response = (
            supabase.table("terms_conditions")
            .select("*")
            .eq("is_active", True)
            .order("effective_date", desc=True)
            .limit(1)
            .execute()
        )

        if not response.data:
            return Response({"content": "No terms found."}, status=200)

        latest_terms = response.data[0]
        return Response({"content": latest_terms["content"]}, status=200)

    except Exception as e:
        print(traceback.format_exc())
        return Response({"error": str(e)}, status=500)
    

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_all_plants(request):
    """
    Get all plants from database for matching with ML predictions
    """
    try:
        # Import your Plant model (adjust the import based on your model name)
        from .models import Plant  # or HerbalPlant, or whatever your model is called
        
        plants = Plant.objects.all()
        plants_data = []
        
        for plant in plants:
            plant_dict = {
                'id': str(plant.id),
                'plant_name': plant.plant_name,
                'scientific_name': plant.scientific_name,
                'common_names': plant.common_names if hasattr(plant, 'common_names') else [],
                'origin': plant.origin if hasattr(plant, 'origin') else '',
                'ailments': plant.ailments if hasattr(plant, 'ailments') else {},
            }
            
            # Handle image field
            if hasattr(plant, 'image') and plant.image:
                plant_dict['image'] = request.build_absolute_uri(plant.image.url)
            
            # Handle images array field
            if hasattr(plant, 'images') and plant.images:
                if isinstance(plant.images, list):
                    plant_dict['images'] = [request.build_absolute_uri(img) if not img.startswith('http') else img for img in plant.images]
                else:
                    plant_dict['images'] = []
            else:
                plant_dict['images'] = []
            
            plants_data.append(plant_dict)
        
        logger.info(f"Returning {len(plants_data)} plants from database")
        return Response(plants_data, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"Error in get_all_plants: {str(e)}")
        return Response(
            {'error': f'Failed to fetch plants: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST']) 
def scan_plant(request):
    try:
        # Get data from request
        image_base64 = request.data.get('imageBase64')
        scanned_at = request.data.get('scanned_at')
        
        if not image_base64:
            return Response(
                {'error': 'No image data provided'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Perform ML prediction
        user_id = request.user.id if request.user.is_authenticated else None
        logger.info(f"🔍 Processing plant scan for user {user_id}")
        prediction = plant_identifier.predict_from_base64(image_base64)
        
        # Save scan record to database (even for unknown/error)
        scan_record = {
            'user_id': str(user_id) if user_id else None,
            'plant_name': prediction.get('plant_name', 'Unknown'),
            'scientific_name': prediction.get('scientific_name', ''),
            'confidence': prediction.get('confidence', 0),
            'status': prediction.get('status', 'error'),
            'scanned_at': scanned_at or datetime.now().isoformat()
        }
        
        try:
            supabase.table('scan_history').insert(scan_record).execute()
            logger.info(f"✅ Scan record saved for user {user_id}")
        except Exception as db_error:
            logger.error(f"Failed to save scan record: {str(db_error)}")
            # Continue even if saving fails
        
        # Handle unknown/error cases early
        if prediction['status'] == 'unknown' or prediction['status'] == 'error':
            prediction['scanned_at'] = scanned_at
            prediction['user_id'] = str(user_id) if user_id else 'Anonymous'
            return Response(prediction, status=status.HTTP_200_OK)
        
        # Fetch all plants from database with images and ailments
        logger.info("📚 Fetching plants from database...")
        plants_response = supabase.table("plants").select("*").execute()
        all_plants = plants_response.data or []
        logger.info(f"📚 Found {len(all_plants)} plants in database")
        
        # Enrich each plant with images and ailments
        for plant in all_plants:
            plant_id = plant["id"]

            # Fetch plant images
            plant_images_resp = (
                supabase.table("plant_images")
                .select("image_url")
                .eq("plant_id", plant_id)
                .execute()
            )
            plant["images"] = [img["image_url"] for img in plant_images_resp.data]
            plant["image"] = plant["images"][0] if plant["images"] else None

            # Fetch ailments grouped by disease type
            ailments_resp = (
                supabase.table("plant_ailments")
                .select("*")
                .eq("plant_id", plant_id)
                .execute()
            )
            
            ailments = ailments_resp.data or []
            
            # Group ailments by disease_type
            ailments_by_disease = {}
            for ailment in ailments:
                disease_type = ailment.get("disease_type", "Other")
                if disease_type not in ailments_by_disease:
                    ailments_by_disease[disease_type] = []
                
                ailments_by_disease[disease_type].append({
                    "ailment": ailment.get("ailment"),
                    "reference": ailment.get("reference"),
                    "herbalBenefit": ailment.get("herbal_benefit"),
                })
            
            plant["ailments"] = ailments_by_disease
        
        # ML folder name to scientific name mapping
        # This maps your ML model's folder names to proper scientific names
        ML_TO_SCIENTIFIC = {
            'pandanus_amaryllifolius': 'Pandanus amaryllifolius',
            'origanum_vulgare': 'Origanum vulgare',
            'aloe_barbadensis': 'Aloe barbadensis',
            'mentha_cordifolia': 'Mentha cordifolia',
            'ocimum_basilicum': 'Ocimum basilicum',
            'averrhoa_bilimbi': 'Averrhoa bilimbi',
            'blumea_balsamifera': 'Blumea balsamifera',
            'centella_asiatica': 'Centella asiatica',
            'coleus_scutellarioides': 'Coleus scutellarioides',
            'corchorus_olitorius': 'Corchorus olitorius',
            'ehretia_microphylla': 'Ehretia microphylla',
            'euphorbia_hirta': 'Euphorbia hirta',
            'jatropha_curcas': 'Jatropha curcas',
            'mangifera_indica': 'Mangifera indica',
            'manihot_esculenta': 'Manihot esculenta',
            'peperomia_pellucida': 'Peperomia pellucida',
            'phyllanthus_niruri': 'Phyllanthus niruri',
            'psidium_guajava': 'Psidium guajava',
            'senna_alata': 'Senna alata',
            'vitex_negundo': 'Vitex negundo',
        }
        
        # Helper function to normalize names for comparison
        def normalize_name(name):
            if not name:
                return ""
            # Remove underscores, hyphens, extra spaces, and lowercase
            normalized = name.lower().replace('_', ' ').replace('-', ' ')
            # Remove multiple spaces
            while '  ' in normalized:
                normalized = normalized.replace('  ', ' ')
            return normalized.strip()
        
        # Helper function to extract genus and species
        def get_genus_species(scientific_name):
            """Extract first two words (genus + species) from scientific name"""
            if not scientific_name:
                return None
            parts = scientific_name.strip().split()
            if len(parts) >= 2:
                return f"{parts[0].lower()} {parts[1].lower()}"
            return None
        
        # Match ML prediction with database
        ml_plant_name = prediction['plant_name']  # e.g., "origanum_vulgare" or "pandanus_amaryllifolius"
        ml_normalized = normalize_name(ml_plant_name)
        
        # Get the proper scientific name from mapping
        ml_scientific = ML_TO_SCIENTIFIC.get(ml_plant_name.lower())
        ml_scientific_normalized = normalize_name(ml_scientific) if ml_scientific else ml_normalized
        
        logger.info(f"🔍 Searching database for: '{ml_plant_name}' -> scientific: '{ml_scientific}'")
        
        matched_plant = None
        
        # Try multiple matching strategies
        for plant in all_plants:
            db_plant_name = normalize_name(plant['plant_name'])
            db_scientific = normalize_name(plant.get('scientific_name', ''))
            
            # Strategy 1: Exact match with scientific_name using mapping
            if ml_scientific and db_scientific == ml_scientific_normalized:
                matched_plant = plant
                logger.info(f"✅ Matched via mapped scientific_name: '{plant['plant_name']}'")
                break
            
            # Strategy 2: Genus + species match (e.g., "pandanus amaryllifolius")
            if ml_scientific:
                ml_genus_species = get_genus_species(ml_scientific)
                db_genus_species = get_genus_species(plant.get('scientific_name', ''))
                
                if ml_genus_species and db_genus_species and ml_genus_species == db_genus_species:
                    matched_plant = plant
                    logger.info(f"✅ Matched via genus+species: '{plant['plant_name']}'")
                    break
            
            # Strategy 3: Exact match with scientific_name (original)
            if db_scientific == ml_normalized:
                matched_plant = plant
                logger.info(f"✅ Matched via scientific_name: '{plant['plant_name']}'")
                break
            
            # Strategy 4: Exact match with plant_name
            if db_plant_name == ml_normalized:
                matched_plant = plant
                logger.info(f"✅ Matched via plant_name: '{plant['plant_name']}'")
                break
            
            # Strategy 5: Check common_names array
            if plant.get('common_names'):
                for common_name in plant['common_names']:
                    if normalize_name(common_name) == ml_normalized:
                        matched_plant = plant
                        logger.info(f"✅ Matched via common_name: '{plant['plant_name']}'")
                        break
                if matched_plant:
                    break
            
            # Strategy 6: Partial word matching (for compound names)
            ml_words = [w for w in ml_normalized.split() if len(w) > 3]
            if ml_words:
                # Check if all significant words appear in either scientific or common name
                if all(word in db_scientific for word in ml_words):
                    matched_plant = plant
                    logger.info(f"✅ Matched via partial scientific_name: '{plant['plant_name']}'")
                    break
                elif all(word in db_plant_name for word in ml_words):
                    matched_plant = plant
                    logger.info(f"✅ Matched via partial plant_name: '{plant['plant_name']}'")
                    break
        
        # Build response
        if matched_plant:
            # ✅ Use database plant name (e.g., "Lemongrass" instead of "pandanus_amaryllifolius")
            response_data = {
                'status': prediction['status'],
                'plant_name': matched_plant['plant_name'],
                'scientific_name': matched_plant['scientific_name'],
                'confidence': prediction['confidence'],
                'confidence_level': prediction['confidence_level'],
                'warning': prediction.get('warning'),
                'plant_data': matched_plant,
                'source': 'database',
                'scanned_at': scanned_at,
                'user_id': str(user_id) if user_id else 'Anonymous'
            }
            logger.info(f"✅ Returning matched plant: '{matched_plant['plant_name']}' (was '{ml_plant_name}')")
        else:
            # No match in database - use mapped scientific name or formatted ML prediction
            logger.warning(f"⚠️ No database match for '{ml_plant_name}'")
            formatted_name = ml_plant_name.replace('_', ' ').title()
            display_scientific = ml_scientific if ml_scientific else ml_plant_name.replace('_', ' ').capitalize()
            
            response_data = {
                'status': prediction['status'],
                'plant_name': formatted_name,
                'scientific_name': display_scientific,
                'confidence': prediction['confidence'],
                'confidence_level': prediction['confidence_level'],
                'warning': prediction.get('warning'),
                'plant_data': None,
                'source': 'ml_only',
                'message': 'Plant identified but not found in database',
                'scanned_at': scanned_at,
                'user_id': str(user_id) if user_id else 'Anonymous'
            }
        
        # Process top predictions with database matching
        if 'top_predictions' in prediction:
            enriched_predictions = []
            
            for pred in prediction['top_predictions']:
                pred_name = pred['plant_name']
                pred_normalized = normalize_name(pred_name)
                
                # Get mapped scientific name
                pred_scientific = ML_TO_SCIENTIFIC.get(pred_name.lower())
                pred_scientific_normalized = normalize_name(pred_scientific) if pred_scientific else pred_normalized
                
                # Try to match each prediction with database
                pred_match = None
                for plant in all_plants:
                    db_plant_name = normalize_name(plant['plant_name'])
                    db_scientific = normalize_name(plant.get('scientific_name', ''))
                    
                    # Check mapped scientific name first
                    if pred_scientific and db_scientific == pred_scientific_normalized:
                        pred_match = plant
                        break
                    
                    # Check genus + species
                    if pred_scientific:
                        pred_genus_species = get_genus_species(pred_scientific)
                        db_genus_species = get_genus_species(plant.get('scientific_name', ''))
                        if pred_genus_species and db_genus_species and pred_genus_species == db_genus_species:
                            pred_match = plant
                            break
                    
                    if (db_scientific == pred_normalized or 
                        db_plant_name == pred_normalized):
                        pred_match = plant
                        break
                    
                    # Check common names
                    if plant.get('common_names'):
                        for common_name in plant['common_names']:
                            if normalize_name(common_name) == pred_normalized:
                                pred_match = plant
                                break
                        if pred_match:
                            break
                
                if pred_match:
                    enriched_predictions.append({
                        'plant_name': pred_match['plant_name'],
                        'scientific_name': pred_match['scientific_name'],
                        'confidence': pred['confidence'],
                        'image_url': pred_match.get('image'),
                        'plant_data': pred_match
                    })
                else:
                    # No database match - use formatted ML name
                    formatted_name = pred_name.replace('_', ' ').title()
                    display_scientific = pred_scientific if pred_scientific else pred_name.replace('_', ' ').capitalize()
                    enriched_predictions.append({
                        'plant_name': formatted_name,
                        'scientific_name': display_scientific,
                        'confidence': pred['confidence'],
                        'image_url': None,
                        'plant_data': None
                    })
            
            response_data['top_predictions'] = enriched_predictions
        
        # Update scan_history with matched plant info
        try:
            supabase.table('scan_history').update({
                'plant_name': response_data['plant_name'],
                'scientific_name': response_data['scientific_name']
            }).eq('user_id', str(user_id)).eq('scanned_at', scanned_at).execute()
        except Exception as update_error:
            logger.error(f"Failed to update scan record: {str(update_error)}")
        
        logger.info(f"✅ Scan complete: {response_data['plant_name']} ({response_data['confidence']:.2f}%)")
        return Response(response_data, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"Error in scan_plant: {str(e)}", exc_info=True)
        return Response(
            {'error': f'Failed to process image: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    
@api_view(['POST'])
def scan_plant_with_file(request):
    """
    Alternative endpoint for file upload instead of base64
    
    Use this if you want to send the image as a file upload
    """
    try:
        image_file = request.FILES.get('image')
        
        if not image_file:
            return Response(
                {'error': 'No image file provided'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Perform prediction
        user_id = request.user.id if request.user.is_authenticated else None
        prediction = plant_identifier.predict_from_file(image_file)
        
        # Save scan record
        scan_record = {
            'user_id': str(user_id) if user_id else None,
            'plant_name': prediction.get('plant_name', 'Unknown'),
            'scientific_name': prediction.get('scientific_name', ''),
            'confidence': prediction.get('confidence', 0),
            'status': prediction.get('status', 'error'),
            'scanned_at': datetime.now().isoformat()
        }
        
        try:
            supabase.table('scan_history').insert(scan_record).execute()
        except Exception as db_error:
            logger.error(f"Failed to save scan record: {str(db_error)}")
        
        # Add metadata
        prediction['user_id'] = str(user_id) if user_id else 'Anonymous'
        
        return Response(prediction, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"Error in scan_plant_with_file: {str(e)}")
        return Response(
            {'error': f'Failed to process image: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
@api_view(['GET'])
def get_dashboard_stats(request):
    try:
        print("🔍 Dashboard stats endpoint called")

        # 1️⃣ Total users
        users_response = (
            supabase
            .table('users')
            .select('id', count='exact')
            .execute()
        )
        total_users = users_response.count or 0

        # 2️⃣ Subscribed (premium) users
        subscribed_response = (
            supabase
            .table('profiles')
            .select('id', count='exact')
            .eq('is_premium', True)
            .execute()
        )
        subscribed_users = subscribed_response.count or 0

        # 3️⃣ Total plant scans (from scan_history)
        scans_response = (
            supabase
            .table('scan_history')
            .select('id', count='exact')
            .execute()
        )
        total_scans = scans_response.count or 0

        print(
            f"✅ Users: {total_users}, "
            f"Premium: {subscribed_users}, "
            f"Scans: {total_scans}"
        )

        return Response({
            'total_users': total_users,
            'subscribed_users': subscribed_users,
            'total_scans': total_scans,
        }, status=status.HTTP_200_OK)

    except Exception as e:
        print("❌ Error:", e)
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(["GET"])
def search_plants_mobile(request):
    """Search plants by name for mobile app (server-side search)"""
    try:
        query = request.GET.get("query", "").strip()
        
        if not query:
            return Response({"plants": []}, status=200)

        print(f"🔍 Searching for: {query}")

        # Search in plant_name and scientific_name fields
        response = (
            supabase.table("plants")
            .select("*")
            .or_(f"plant_name.ilike.%{query}%,scientific_name.ilike.%{query}%")
            .execute()
        )

        plants = response.data or []
        print(f"✅ Found {len(plants)} plants")

        # Fetch related images and ailments for each plant
        for plant in plants:
            plant_id = plant["id"]
            
            # Fetch images
            images_resp = (
                supabase.table("plant_images")
                .select("image_url")
                .eq("plant_id", plant_id)
                .execute()
            )
            plant["images"] = [img["image_url"] for img in images_resp.data]
            plant["image_url"] = plant["images"][0] if plant["images"] else None
            
            # Fetch ailments
            ailments_resp = (
                supabase.table("plant_ailments")
                .select("ailment, disease_type")
                .eq("plant_id", plant_id)
                .execute()
            )
            
            ailments_data = ailments_resp.data or []
            plant["ailments"] = [a["ailment"] for a in ailments_data]
            plant["disease_types"] = list(set([a["disease_type"] for a in ailments_data]))

        return Response({"plants": plants}, status=200)

    except Exception as e:
        print(f"❌ Error in search_plants_mobile: {e}")
        traceback.print_exc()
        return Response({"error": str(e)}, status=500)
    


    
@api_view(["GET"])
def search_by_ailment_mobile(request):
    """Search plants by ailment for mobile app (server-side search)"""
    try:
        ailment = request.GET.get("ailment", "").strip()
        
        if not ailment:
            return Response({"plants": []}, status=200)

        print(f"🔍 Searching for ailment: {ailment}")

        # First, find all plant_ids that have this ailment
        ailments_resp = (
            supabase.table("plant_ailments")
            .select("plant_id, ailment, disease_type")
            .ilike("ailment", f"%{ailment}%")
            .execute()
        )
        
        ailments_data = ailments_resp.data or []
        
        if not ailments_data:
            print(f"❌ No plants found for ailment: {ailment}")
            return Response({"plants": []}, status=200)
        
        # Get unique plant_ids
        plant_ids = list(set([a["plant_id"] for a in ailments_data]))
        print(f"✅ Found {len(plant_ids)} plants with ailment: {ailment}")
        
        # Fetch plant details for these plant_ids
        plants_resp = (
            supabase.table("plants")
            .select("*")
            .in_("id", plant_ids)
            .execute()
        )
        
        plants = plants_resp.data or []
        
        # Fetch related images and all ailments for each plant
        for plant in plants:
            plant_id = plant["id"]
            
            # Fetch images
            images_resp = (
                supabase.table("plant_images")
                .select("image_url")
                .eq("plant_id", plant_id)
                .execute()
            )
            plant["images"] = [img["image_url"] for img in images_resp.data]
            plant["image_url"] = plant["images"][0] if plant["images"] else None
            
            # Fetch all ailments for this plant
            all_ailments_resp = (
                supabase.table("plant_ailments")
                .select("ailment, disease_type")
                .eq("plant_id", plant_id)
                .execute()
            )
            
            all_ailments_data = all_ailments_resp.data or []
            plant["ailments"] = [a["ailment"] for a in all_ailments_data]
            plant["disease_types"] = list(set([a["disease_type"] for a in all_ailments_data]))
        
        print(f"✅ Returning {len(plants)} plants for ailment: {ailment}")
        return Response({"plants": plants}, status=200)

    except Exception as e:
        print(f"❌ Error in search_by_ailment_mobile: {e}")
        traceback.print_exc()
        return Response({"error": str(e)}, status=500)
# ============================================================================
# ✅ GET SINGLE PLANT BY ID (for Plant Details page)
# ============================================================================
@api_view(["GET"])
def get_plant_by_id(request, plant_id):
    try:
        # Fetch the plant
        response = (
            supabase.table("plants")
            .select("*")
            .eq("id", plant_id)
            .single()
            .execute()
        )
        
        if not response.data:
            return Response({"error": "Plant not found"}, status=404)
        
        plant = response.data

        # Fetch ALL plant images
        plant_images_resp = (
            supabase.table("plant_images")
            .select("image_url")
            .eq("plant_id", plant_id)
            .execute()
        )
        plant["images"] = [img["image_url"] for img in plant_images_resp.data]

        # Fetch ailments
        ailments_resp = (
            supabase.table("plant_ailments")
            .select("*")
            .eq("plant_id", plant_id)
            .execute()
        )
        
        ailments = ailments_resp.data or []
        
        # Group ailments by disease_type
        ailments_by_disease = {}
        for ailment in ailments:
            disease_type = ailment.get("disease_type", "Other")
            if disease_type not in ailments_by_disease:
                ailments_by_disease[disease_type] = []
            
            ailments_by_disease[disease_type].append({
                "ailment": ailment.get("ailment"),
                "reference": ailment.get("reference"),
                "herbalBenefit": ailment.get("herbal_benefit"),
            })
        
        plant["ailments"] = ailments_by_disease

        return Response(plant, status=200)

    except Exception as e:
        print("❌ Error fetching plant:", traceback.format_exc())
        return Response({"error": str(e)}, status=500)


@api_view(["GET"])
@permission_classes([AllowAny])  # Change to admin-only in production
def get_system_logs(request):
    """
    Fetch recent system logs for admin dashboard
    """
    try:
        limit = request.GET.get("limit", 50)
        log_level = request.GET.get("level")  # Optional filter: INFO, ERROR, WARNING
        
        query = supabase.table("system_logs").select("*").order("created_at", desc=True).limit(int(limit))
        
        if log_level:
            query = query.eq("log_level", log_level.upper())
        
        response = query.execute()
        logs = response.data or []
        
        # Format logs for display
        formatted_logs = []
        for log in logs:
            formatted_logs.append({
                "id": log["id"],
                "level": log["log_level"],
                "message": log["message"],
                "user_id": log.get("user_id"),
                "details": log.get("details"),
                "timestamp": log["created_at"]
            })
        
        return Response({"logs": formatted_logs}, status=200)
    
    except Exception as e:
        print(f"❌ Error fetching system logs: {e}")
        traceback.print_exc()
        return Response({"error": str(e)}, status=500)


@api_view(["GET"])
@permission_classes([AllowAny])  # Change to admin-only in production
def get_notifications(request):
    """
    Fetch recent notifications for admin dashboard
    """
    try:
        limit = int(request.GET.get("limit", 20))
        unread_only = request.GET.get("unread_only", "false").lower() == "true"

        query = (
            supabase
            .table("admin_notifications")
            .select("*")
            .order("created_at", desc=True)
            .limit(limit)
        )

        if unread_only:
            query = query.eq("is_read", False)

        response = query.execute()
        rows = response.data or []

        # ✅ NORMALIZE RESPONSE FOR FRONTEND
        notifications = []
        for n in rows:
            notifications.append({
                "id": str(n["id"]),
                "type": n.get("type"),
                "title": n.get("title"),
                "message": n.get("message"),
                "user_id": n.get("user_id"),
                "is_read": n.get("is_read", False),
                "created_at": n.get("created_at")
            })

        unread_response = (
            supabase
            .table("admin_notifications")
            .select("id", count="exact")
            .eq("is_read", False)
            .execute()
        )

        return Response({
            "notifications": notifications,
            "unread_count": unread_response.count or 0
        }, status=200)

    except Exception as e:
        print(f"❌ Error fetching notifications: {e}")
        traceback.print_exc()
        return Response({"error": str(e)}, status=500)


@api_view(["PATCH"])
@permission_classes([AllowAny])
def mark_notification_read(request, notification_id):
    """
    Mark a notification as read
    """
    try:
        response = (
            supabase
            .table("admin_notifications")
            .update({"is_read": True})
            .eq("id", str(notification_id))  # 👈 force string match
            .select("*")                     # 👈 RETURN UPDATED ROW
            .execute()
        )

        if not response.data:
            return Response({"error": "Notification not found"}, status=404)

        return Response({
            "message": "Notification marked as read",
            "notification": response.data[0]
        }, status=200)

    except Exception as e:
        print(f"❌ Error marking notification as read: {e}")
        return Response({"error": str(e)}, status=500)

@api_view(["POST"])
@permission_classes([AllowAny])
def mark_all_notifications_read(request):
    """
    Mark all notifications as read
    """
    try:
        response = (
            supabase
            .table("admin_notifications")
            .update({"is_read": True})
            .eq("is_read", False)
            .select("id")
            .execute()
        )

        return Response({
            "message": "All notifications marked as read",
            "updated_count": len(response.data or [])
        }, status=200)

    except Exception as e:
        print(f"❌ Error marking all notifications as read: {e}")
        return Response({"error": str(e)}, status=500)


# ============================================================================
# ✅ HELPER FUNCTIONS TO CREATE LOGS & NOTIFICATIONS
# ============================================================================

def create_system_log(level, message, user_id=None, details=None):
    """
    Helper function to create system logs
    level: INFO, WARNING, ERROR, SUCCESS
    """
    try:
        log_data = {
            "log_level": level.upper(),
            "message": message,
            "user_id": str(user_id) if user_id else None,
            "details": details
        }
        supabase.table("system_logs").insert(log_data).execute()
        print(f"📝 Log created: [{level}] {message}")
    except Exception as e:
        print(f"❌ Failed to create log: {e}")


def create_notification(notification_type, title, message, user_id=None, related_id=None):
    """
    Helper function to create admin notifications
    """
    try:
        notification_data = {
            "type": notification_type,
            "title": title,
            "message": message,
            "user_id": str(user_id) if user_id else None,
            "related_id": str(related_id) if related_id else None,
            "is_read": False
        }
        supabase.table("admin_notifications").insert(notification_data).execute()
        print(f"🔔 Notification created: {title}")
    except Exception as e:
        print(f"❌ Failed to create notification: {e}")


