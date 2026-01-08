from django.urls import path
from . import views

urlpatterns = [
    path('dashboard/stats/', views.get_dashboard_stats, name='dashboard_stats'),
    path("login/", views.login, name="login"),
    path("google-login/", views.google_login, name="google-login"),
    path("signup/", views.signup, name="signup"),
    path("profile/", views.profile, name="profile"),
    path("search-address/", views.search_address, name="search_address"),
    path("update_profile/", views.update_profile, name="update_profile"), 
    path('search_plants/', views.search_plants, name='search_plants'), # ✅ add this line
    path("subscribe_premium/", views.subscribe_premium, name="subscribe_premium"),


     # ✅ new route for PlantPal Web
    path('admin-signup/', views.admin_signup, name='admin_signup'),
    path('refresh_token/', views.refresh_token, name='refresh_token'),
    path("admin_login/", views.admin_login, name="admin_login"),
    path("add_plant/", views.add_plant, name="add_plant"),
    path("get_plants/", views.get_plants, name="get_plants"),
    path("search_plants/", views.search_plants, name="search_plants"),
    path("api/scan-plant/", views.scan_plant, name="scan_plant"),
    path("get_search_history/", views.get_search_history, name="get_search_history"),  
    path("update_plant/<uuid:plant_id>/", views.update_plant, name="update_plant"),
    path("delete_plant/<uuid:plant_id>/", views.delete_plant, name="delete_plant"),

    # Terms & Conditions Management
    path("add_terms_conditions/", views.add_terms_conditions, name="add_terms_conditions"),
    path("get_terms_conditions/", views.get_terms_conditions, name="get_terms_conditions"),
    path("update-admin-profile/", views.update_admin_profile, name='update-admin-profile'),
    path("get_latest_terms_conditions/", views.get_latest_terms_conditions, name="get_latest_terms_conditions"),

    #User Managemen Admin  
    path("get_users/", views.get_users, name="get_users"),
    path("delete_user/<str:user_id>/", views.delete_user, name="delete_user"),   

    #Scan Plant
    path('scan_plant/', views.scan_plant, name='scan_plant'),
    path('scan_plant_file/', views.scan_plant_with_file, name='scan_plant_file'),
    path('api/plants/', views.get_all_plants, name='get_all_plants'), 
    

    
   #mobile
    
    path("search_plants_mobile/", views.search_plants_mobile, name="search_plants_mobile"),  # Add this line
    path('search_by_ailment_mobile/', views.search_by_ailment_mobile, name='search_by_ailment_mobile'),
    path('plants/<uuid:plant_id>/', views.get_plant_by_id, name='get_plant_by_id'),
   


# System Logs & Notifications
    path('api/admin/logs/', views.get_system_logs, name='get_system_logs'),
    path('api/admin/notifications/', views.get_notifications, name='get_notifications'),
    path('api/admin/notifications/<uuid:notification_id>/read/', views.mark_notification_read, name='mark_notification_read'),
    path('api/admin/notifications/read-all/', views.mark_all_notifications_read, name='mark_all_notifications_read'),


    

]



