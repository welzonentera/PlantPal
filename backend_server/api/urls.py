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

    path("subscribe_premium/", views.subscribe_premium, name="subscribe_premium"),

    # Admin
    path('admin-signup/', views.admin_signup, name='admin_signup'),
    path("admin_login/", views.admin_login, name="admin_login"),
    path("refresh_token/", views.refresh_token, name='refresh_token'),
    path("add_plant/", views.add_plant, name="add_plant"),
    path("get_plants/", views.get_plants, name="get_plants"),
    path("update_plant/<uuid:plant_id>/", views.update_plant, name="update_plant"),
    path("delete_plant/<uuid:plant_id>/", views.delete_plant, name="delete_plant"),

    # Plant Search
    path('search_plants/', views.search_plants, name='search_plants'),
    path('search_plants_mobile/', views.search_plants_mobile, name='search_plants_mobile'),
    path('search_by_ailment_mobile/', views.search_by_ailment_mobile, name='search_by_ailment_mobile'),

    # Scan Plant
    path('scan_plant/', views.scan_plant, name='scan_plant'), 
    path('scan_plant_file/', views.scan_plant_with_file, name='scan_plant_file'),
    path('api/plants/', views.get_all_plants, name='get_all_plants'),
    path('trending_plants/', views.get_trending_plants, name='trending_plants'),

    # Plants
    path('api/plants/', views.get_all_plants, name='get_all_plants'),
    path('plants/<uuid:plant_id>/', views.get_plant_by_id, name='get_plant_by_id'),

    # Journal
    path('add_journal/', views.add_to_journal, name='add_to_journal'),
    path('get_user_journal/', views.get_user_journal, name='get_user_journal'),
    path('update_journal/<uuid:journal_id>/', views.update_journal, name='update_journal'),
    path('upload_note_image/', views.upload_note_image, name='upload_note_image'),
    path('delete_journal/<uuid:journal_id>/', views.delete_journal_entry, name='delete_journal_entry'),
    path('get_journal_details/<uuid:journal_id>/', views.get_journal_details, name='get_journal_details'),
   
    # Terms & Conditions
    path("add_terms_conditions/", views.add_terms_conditions, name="add_terms_conditions"),
    path("get_terms_conditions/", views.get_terms_conditions, name="get_terms_conditions"),
    path("get_latest_terms_conditions/", views.get_latest_terms_conditions, name="get_latest_terms_conditions"),
    path("update-admin-profile/", views.update_admin_profile, name='update-admin-profile'),

    # Users
    path("get_users/", views.get_users, name="get_users"),
    path("delete_user/<str:user_id>/", views.delete_user, name="delete_user"),

    # Logs & Notifications
    path('api/admin/logs/', views.get_system_logs, name='get_system_logs'),
    path('api/admin/notifications/', views.get_notifications, name='get_notifications'),
    path('api/admin/notifications/<uuid:notification_id>/read/', views.mark_notification_read, name='mark_notification_read'),
    path('api/admin/notifications/read-all/', views.mark_all_notifications_read, name='mark_all_notifications_read'),

    #Feedbacks
    path('feedback/', views.submit_feedback, name='submit_feedback'),
    path('feedback/stats/', views.get_feedback_stats, name='feedback_stats'),
    path('feedback/list/', views.get_feedback_list, name='feedback_list'),
    path('feedback/<uuid:feedback_id>/image/', views.get_feedback_image, name='get_feedback_image'), 
    path('feedback/update/<uuid:feedback_id>/', views.update_feedback_status, name='update_feedback_status'),

    #Notifications
    path('get_user_notifications/', views.get_user_notifications, name='get_user_notifications'),
    path('mark_notification_read/', views.mark_notification_read, name='mark_notification_read'),
    path('clear_all_notifications/', views.clear_all_notifications, name='clear_all_notifications'),

]
