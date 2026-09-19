import React, { useEffect, useState } from "react";
import { collection, getDoc, getDocs, doc } from "firebase/firestore";
import { db } from "../../../../firebase/firebase";
import { callFn } from "../../../../services/functionsClient";
import { OMAN_GOVERNORATES } from "../../../../constants/omanGovernorates";


type Props = {
  open: boolean;
  onClose: () => void;
  users: any[];
};


type SupervisorRole =
  | "ministry_super"
  | "super"
  | "tenant_admin"
  | "exam_super";


const roleOptions: Array<{
  value: SupervisorRole;
  title: string;
  description: string;
}> = [
  {
    value: "ministry_super",
    title: "مشرف الوزارة",
    description: "حساب إشرافي على مستوى الوزارة",
  },
  {
    value: "super",
    title: "مشرف المحافظة",
    description: "يرتبط بمحافظة محددة",
  },
  {
    value: "tenant_admin",
    title: "مشرف المدرسة",
    description: "يرتبط بمدرسة محددة",
  },
  {
    value: "exam_super",
    title: "مشرف مركز الدبلوم",
    description: "يرتبط بمركز دبلوم محدد",
  },
];


export default function AddSupervisorDrawer({
  open,
  onClose,
  users,
}: Props) {

  const [role, setRole] =
    useState<SupervisorRole>("ministry_super");

  const [name,setName] = useState("");
  const [email,setEmail] = useState("");
  const [saving,setSaving] = useState(false);

  const [governorate,setGovernorate] = useState("");

  const [schoolId,setSchoolId] = useState("");
  const [centerId,setCenterId] = useState("");

  const [schools,setSchools] = useState<any[]>([]);
  const [centers,setCenters] = useState<any[]>([]);
  const [governorates,setGovernorates] = useState<string[]>([]);
  const [feedback,setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const clearFeedback = () => {
    if(feedback){
      setFeedback(null);
    }
  };

  const createAllowUser =
    callFn<any,any>("adminUpsertAllowlist");

  const handleCreate = async()=>{

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    clearFeedback();


    if(!cleanName || !cleanEmail){

      setFeedback({
        type: "error",
        text: "الاسم والبريد الإلكتروني مطلوبان.",
      });

      return;
    }


    if(role === "super" && !governorate){

      setFeedback({
        type: "error",
        text: "يجب اختيار المحافظة لمشرف المحافظة.",
      });

      return;
    }


    if(role === "tenant_admin"){

      if(!governorate){

        setFeedback({
          type: "error",
          text: "اختر المحافظة أولاً.",
        });

        return;
      }

      if(!schoolId){

        setFeedback({
          type: "error",
          text: "يجب اختيار المدرسة.",
        });

        return;
      }

    }


    if(role === "exam_super"){

      if(!governorate){

        setFeedback({
          type: "error",
          text: "اختر المحافظة أولاً.",
        });

        return;
      }

      if(!centerId){

        setFeedback({
          type: "error",
          text: "يجب اختيار مركز الدبلوم.",
        });

        return;
      }

    }


    const emailExists =
      (users || []).some(
        (user:any)=>
          String(user?.email || "")
            .trim()
            .toLowerCase() === cleanEmail
      );


    if(emailExists){

      setFeedback({
        type: "error",
        text: "البريد الإلكتروني مستخدم مسبقاً، اختر بريداً آخر.",
      });

      return;
    }


    const payload:any = {
      email: cleanEmail,
      name: cleanName,
      role,
      enabled: true,
      createOnly: true,
    };


    if(role === "super"){

      payload.governorate =
        governorate;

    }


    if(role === "tenant_admin"){

      payload.governorate =
        governorate;

      payload.tenantId =
        schoolId;

    }


    if(role === "exam_super"){

      payload.governorate =
        governorate;

      payload.tenantId =
        centerId;

    }


    setSaving(true);


    try{

      await createAllowUser(
        payload
      );


      setName("");
      setEmail("");
      setGovernorate("");
      setSchoolId("");
      setCenterId("");


      setFeedback({
        type: "success",
        text: "تم إنشاء المشرف وربطه بالنطاق بنجاح",
      });


      setTimeout(()=>{

        setFeedback(null);
        onClose();

      },2000);


    }catch(error){

      console.error(
        "CREATE_SUPERVISOR_FAILED",
        error
      );


      setFeedback({
        type: "error",
        text: "تعذر إنشاء المشرف. لم يتم حفظ أي تغيير.",
      });


    }finally{

      setSaving(false);

    }

  };


  useEffect(() => {

    if (!open) {
      setRole("ministry_super");
      setGovernorate("");
      setSchoolId("");
      setCenterId("");
      return;
    }


    const loadOrganizations = async()=>{

      const snap = await getDocs(
        collection(db,"tenants")
      );


      const schoolRows:any[] = [];
      const centerRows:any[] = [];
      const govSet = new Set<string>();


      for(const tenant of snap.docs){

        const root:any = tenant.data() || {};

        const cfgSnap = await getDoc(
          doc(
            db,
            "tenants",
            tenant.id,
            "meta",
            "config"
          )
        );


        const cfg:any =
          cfgSnap.exists()
            ? cfgSnap.data()
            : {};


        const gov =
          String(
            cfg?.governorate ||
            cfg?.regionAr ||
            cfg?.region ||
            cfg?.tenantGovernorate ||
            cfg?.governorateName ||
            root?.governorate ||
            root?.tenantGovernorate ||
            root?.regionAr ||
            root?.region ||
            ""
          ).trim();


        if(gov){
          govSet.add(gov);
        }


        const row = {
          id: tenant.id,
          governorate: gov,
          name:
            root?.centerName ||
            cfg?.centerNameAr ||
            root?.name ||
            cfg?.schoolNameAr ||
            tenant.id,
          isCenter:
            root?.isDiplomaCenter === true ||
            root?.diplomaCenter === true ||
            root?.isExamCenter === true ||
            root?.examCenter === true ||
            String(root?.tenantType || "")
              .toLowerCase()
              .includes("diploma") ||
            String(root?.type || "")
              .toLowerCase()
              .includes("diploma") ||
            String(root?.centerType || "")
              .toLowerCase()
              .includes("center") ||
            String(root?.tenantType || "")
              .toLowerCase()
              .includes("diploma") ||
            String(root?.centerType || "")
              .toLowerCase()
              .includes("center")
        };


        if(row.isCenter){
          centerRows.push(row);
        }else{
          schoolRows.push(row);
        }

      }


      // إضافة المراكز المرتبطة من allowlist حتى لو كان tenant غير فعال أو محذوف
      try {

        const allowSnap = await getDocs(
          collection(db,"allowlist")
        );


        allowSnap.docs.forEach((item)=>{

          const data:any = item.data() || {};

          if(
            data.role === "exam_super" &&
            data.tenantId
          ){

            const exists =
              centerRows.some(
                (x:any)=>x.id === data.tenantId
              );

            if(!exists){

              centerRows.push({

                id:data.tenantId,

                governorate:
                  String(
                    data.governorate || ""
                  ).trim(),

                name:
                  data.tenantName ||
                  data.schoolName ||
                  data.tenantId,

                isCenter:true

              });

            }

          }

        });
      } catch(error){

        console.error(
          "ALLOWLIST_CENTER_LOAD_FAILED",
          error
        );

      }


      setSchools(schoolRows);
      setCenters(centerRows);



      try {

        const allowSnap = await getDocs(
          collection(db,"allowlist")
        );

        allowSnap.docs.forEach((item)=>{

          const data:any = item.data() || {};

          const gov =
            String(
              data.governorate ||
              data.regionAr ||
              data.region ||
              ""
            ).trim();

          if(gov){
            govSet.add(gov);
          }

        });

      } catch(error){

        console.error(
          "ALLOWLIST_GOVERNORATE_LOAD_FAILED",
          error
        );

      }


      setGovernorates(
        [...OMAN_GOVERNORATES]
          .sort((a,b)=>a.localeCompare(b,"ar"))
      );

    };


    loadOrganizations();

  },[open]);


  useEffect(() => {

    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };

  }, [open, onClose]);


  if (!open) {
    return null;
  }


  return (
    <div
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) {
          onClose();
        }
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(15,23,42,.42)",
        display: "flex",
        justifyContent: "flex-start",
        direction: "rtl",
      }}
    >

      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-supervisor-title"
        style={{
          width: "min(520px, 96vw)",
          height: "100%",
          overflowY: "auto",
          background: "linear-gradient(180deg,#ffffff 0%,#f7fbf7 55%,#fff8e6 100%)",
          padding: 24,
          boxShadow: "16px 0 45px rgba(15,23,42,.18)",
        }}
      >

        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 15,
            marginBottom: 24,
          }}
        >

          <div>
            <h2
              id="add-supervisor-title"
              style={{
                margin: 0,
                color: "#17345f",
                fontSize: 28,
              }}
            >
              إضافة مشرف
            </h2>

            <p
              style={{
                margin: "7px 0 0",
                color: "#526274",
                fontSize: 16,
                lineHeight: 1.8,
              }}
            >
              اختر نوع الحساب الإشرافي الذي تريد إضافته.
            </p>
          </div>


          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق نافذة إضافة مشرف"
            style={{
              width: 38,
              height: 38,
              border: 0,
              borderRadius: 11,
              background: "#feecec",
              color: "#b42318",
              cursor: "pointer",
              fontSize: 21,
              fontWeight: 900,
              lineHeight: 1,
              boxShadow: "0 5px 14px rgba(180,35,24,.10)",
            }}
          >
            ×
          </button>

        </header>


        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(2, minmax(0,1fr))",
            gap: 10,
          }}
        >

          {roleOptions.map((item) => {

            const selected =
              role === item.value;

            const accent =
              item.value === "ministry_super"
                ? "#00843d"
                : item.value === "super"
                ? "#2563eb"
                : item.value === "tenant_admin"
                ? "#7c3aed"
                : "#c9a038";

            const selectedBackground =
              item.value === "ministry_super"
                ? "linear-gradient(135deg,#e9f8ef,#ffffff)"
                : item.value === "super"
                ? "linear-gradient(135deg,#edf4ff,#ffffff)"
                : item.value === "tenant_admin"
                ? "linear-gradient(135deg,#f4eeff,#ffffff)"
                : "linear-gradient(135deg,#fff6d8,#ffffff)";

            return (
              <button
                key={item.value}
                type="button"
                onClick={() => {
                  clearFeedback();
                  setRole(item.value);
                  setGovernorate("");
                  setSchoolId("");
                  setCenterId("");
                }}
                aria-pressed={selected}
                style={{
                  minHeight: 125,
                  textAlign: "right",
                  border: selected
                    ? `2px solid ${accent}`
                    : `1.5px solid ${accent}66`,
                  background: selected
                    ? selectedBackground
                    : "#ffffff",
                  borderRadius: 20,
                  padding: 20,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  borderWidth: selected ? 3 : 2,
                  boxShadow: selected
                    ? `0 10px 25px ${accent}25`
                    : "0 4px 12px rgba(15,23,42,.05)",
                  transform: selected
                    ? "translateY(-2px)"
                    : "none",
                  transition: "all .2s ease",
                }}
              >

                <strong
                  style={{
                    display: "block",
                    color: accent,
                    marginBottom: 10,
                    fontSize: 16,
                  }}
                >
                  {item.title}
                </strong>

                <span
                  style={{
                    display: "block",
                    color: "#526274",
                    fontSize: 12,
                    lineHeight: 1.9,
                  }}
                >
                  {item.description}
                </span>

              </button>
            );
          })}

        </div>



        {
          role !== "ministry_super" && (

            <section
              style={{
                marginTop:22,
                display:"grid",
                gap:14,
                padding:16,
                borderRadius:14,
                background:"#ffffff",
                border:"1px solid #dbe4ef",
              }}
            >

              <label
                style={{
                  fontWeight:900,
                  color:"#17345f",
                  fontSize:16,
                }}
              >
                المحافظة
              </label>


              <select
                value={governorate}
                onChange={(e)=>{
                  setGovernorate(e.target.value);
                  setSchoolId("");
                  setCenterId("");
                }}
                style={{
                  height:46,
                  borderRadius:12,
                  border:"2px solid #17345f",
                  padding:"0 12px",
                  fontSize:16,
                  fontWeight:800,
                  color:"#17345f",
                }}
              >

                <option value="">
                  اختر المحافظة
                </option>

                {governorates.map((g)=>(
                  <option
                    key={g}
                    value={g}
                  >
                    {`محافظة ${g}`}
                  </option>
                ))}

              </select>



              {
                role === "tenant_admin" && (

                  <>

                  <label
                    style={{
                      fontWeight:900,
                      color:"#17345f",
                      fontSize:16,
                    }}
                  >
                    المدرسة
                  </label>


                  <select
                    value={schoolId}
                    disabled={!governorate}
                    onChange={(e)=>setSchoolId(e.target.value)}
                    style={{
                      height:46,
                      borderRadius:12,
                      border:"2px solid #17345f",
                      padding:"0 12px",
                      fontSize:16,
                      fontWeight:800,
                      color:"#17345f",
                      opacity: governorate ? 1 : .5,
                    }}
                  >

                    <option value="">
                      {
                        governorate
                          ? "اختر المدرسة"
                          : "اختر المحافظة أولاً"
                      }
                    </option>


                    {
                      schools
                      .filter(
                        x =>
                         String(x.governorate || "").trim() ===
                         String(governorate || "").trim()
                      )
                      .map((s)=>(
                        <option
                          key={s.id}
                          value={s.id}
                        >
                          {s.name}
                        </option>
                      ))
                    }

                  </select>

                  </>

                )
              }




              {
                role === "exam_super" && (

                  <>

                  <label
                    style={{
                      fontWeight:900,
                      color:"#17345f",
                      fontSize:16,
                    }}
                  >
                    مركز الدبلوم
                  </label>


                  <select
                    value={centerId}
                    disabled={!governorate}
                    onChange={(e)=>setCenterId(e.target.value)}
                    style={{
                      height:46,
                      borderRadius:12,
                      border:"2px solid #17345f",
                      padding:"0 12px",
                      fontSize:16,
                      fontWeight:800,
                      color:"#17345f",
                      opacity: governorate ? 1 : .5,
                    }}
                  >

                    <option value="">
                      {
                        governorate
                          ? "اختر المركز"
                          : "اختر المحافظة أولاً"
                      }
                    </option>


                    {
                      centers.filter(
                        x => !governorate || x.governorate === governorate
                      )
                      .map((c)=>(
                        <option
                          key={c.id}
                          value={c.id}
                        >
                          {c.name}
                        </option>
                      ))
                    }

                  </select>

                  </>

                )
              }


            </section>

          )
        }

        <section
          style={{
            marginTop: 22,
            padding: 18,
            borderRadius: 16,
            border: "1px solid #dbe4ef",
            background: "#ffffff",
          }}
        >

          <strong
            style={{
              display: "block",
              marginBottom: 12,
              color: "#17345f",
              fontSize: 18,
            }}
          >
            بيانات المشرف
          </strong>


          <input
            value={name}
              onChange={(e)=>{
                clearFeedback();
                setName(e.target.value);
              }}
            
            placeholder="اسم المشرف"
            style={{
              width:"100%",
              boxSizing:"border-box",
              marginBottom:12,
              padding:"13px 14px",
              borderRadius:12,
              border:"2px solid #17345f",
              background:"#ffffff",
              color:"#17345f",
              fontSize:16,
              fontWeight:800,
              fontFamily:"inherit",
            }}
          />


          <input
            value={email}
              onChange={(e)=>{
                clearFeedback();
                setEmail(e.target.value);
              }}
            
            placeholder="البريد الإلكتروني"
            style={{
              width:"100%",
              boxSizing:"border-box",
              padding:"13px 14px",
              borderRadius:12,
              border:"2px solid #17345f",
              background:"#ffffff",
              color:"#17345f",
              fontSize:16,
              fontWeight:800,
              fontFamily:"inherit",
              direction:"ltr",
              textAlign:"right",
            }}
          />

        </section>



        {
          feedback && (
            <div
              style={{
                marginTop: 20,
                padding: "14px 16px",
                borderRadius: 14,
                background:
                  feedback.type === "error"
                    ? "#fff1f2"
                    : "#f0fdf4",
                border:
                  feedback.type === "error"
                    ? "1.5px solid #ef4444"
                    : "1.5px solid #16a34a",
                color:
                  feedback.type === "error"
                    ? "#b91c1c"
                    : "#166534",
                fontSize: 16,
                fontWeight: 900,
                textAlign: "center",
              }}
            >
              {feedback.text}
            </div>
          )
        }
        <footer
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
            marginTop: 24,
          }}
        >

          <button
            type="button"
            onClick={onClose}
            style={{
              minWidth: 92,
              height: 46,
              borderRadius: 13,
              border: "1px solid #efb4b4",
              background: "#fff5f5",
              color: "#a61b1b",
              padding: "0 20px",
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: 16,
              fontWeight: 900,
            }}
          >
            إلغاء
          </button>


          <button
            type="button"
            onClick={handleCreate}
            disabled={saving}
            style={{
              minWidth: 105,
              height: 46,
              borderRadius: 13,
              border: 0,
              background: "linear-gradient(135deg,#00843d,#c9a038)",
              color: "#ffffff",
              padding: "0 22px",
              fontFamily: "inherit",
              fontSize: 16,
              fontWeight: 900,
              cursor: saving ? "not-allowed" : "pointer",
              opacity: saving ? 0.65 : 1,
              boxShadow: "0 7px 18px rgba(0,132,61,.14)",
            }}
          >
            {saving ? "جاري الإضافة..." : "إضافة المشرف"}
          </button>

        </footer>

      </aside>

    </div>
  );
}















