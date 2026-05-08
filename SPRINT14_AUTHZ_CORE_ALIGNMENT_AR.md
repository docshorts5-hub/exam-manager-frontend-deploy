# Sprint 14

تم في هذه المرحلة توحيد أجزاء إضافية من طبقة auth مع authz/capabilities بحيث يصبح super_admin = مالك المنصة بشكل أوضح داخل:
- AuthContext
- SessionContext
- RequireRole
- permissions
- ProtectedRoute/SystemRoute/SuperRoute

أبرز ما أضيف:
- authzSnapshot داخل AuthContext
- can(capability) داخل AuthContext
- capabilities و primaryRoleLabel
- دعم capabilities داخل RequireRole

الهدف من هذه المرحلة هو تقليل الاعتماد على فحص role strings المباشر داخل الحراس والسياق.
