  // ====== Create tenant ======
  const createTenant = async () => {
    const id = safeId(newTenantId);
    const name = String(newTenantName || "").trim();
    if (!id || !name) {
      alert("يرجى إدخال اسم المدرسة و Tenant ID بشكل صحيح.");
      return;
    }

    // السوبر يثبت محافظته على المدرسة الجديدة
    const gov = canSeeAllGovs ? String(myGov || MINISTRY_SCOPE) : myGov;
    if (!gov) {
      alert("حساب السوبر غير مرتبط بمحافظة.");
      return;
    }

    try {
      const cfgRef = doc(db, "tenants", id, "meta", "config");

      // لو المدرسة موجودة وبها محافظة مختلفة (ولستَ الوزارة) امنع التعديل
      try {
        const existingCfg = await getDoc(cfgRef);
        if (existingCfg.exists()) {
          const existingGov = String((existingCfg.data() as any)?.governorate || "").trim();
          if (!canSeeAllGovs && existingGov && existingGov !== gov) {
            alert("لا يمكنك إنشاء/تعديل مدرسة خارج محافظتك.");
            return;
          }
        }
      } catch {
        // ignore
      }

      // ✅ نكتب meta/config أولاً
      await setDoc(
        cfgRef,
        {
          governorate: gov,
          regionAr: gov,
          ministryAr: "سلطنة عمان - وزارة التربية والتعليم",
          schoolNameAr: name,
          systemNameAr: "نظام إدارة الامتحانات الذكي",
          wilayatAr: "",
          logoUrl: MINISTRY_LOGO_URL,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // ثم وثيقة tenant الرئيسية
      await setDoc(
        doc(db, "tenants", id),
        {
          name,
          enabled: !!newTenantEnabled,
          governorate: gov,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setNewTenantName("");
      setNewTenantId("");
      setNewTenantEnabled(true);
      setSelectedTenantId(id);
      alert("تم إنشاء المدرسة بنجاح ✅");
    } catch (e: any) {
      console.error(e);
      alert("تعذر إنشاء المدرسة. تأكد من الصلاحيات ثم جرّب مرة أخرى.");
    }
  };
