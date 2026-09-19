import React, {useEffect, useState} from "react";
import {Navigate, useNavigate} from "react-router-dom";
import {collection, getDocs} from "firebase/firestore";
import {db} from "../firebase/firebase";
import {callFn} from "../services/functionsClient";

import "../pages/owner/ownerDiplomaCenters.css";
import SCHOOL_ICON_LOCAL from "../assets/branding/schools-diploma.png";
import MINISTRY_LOGO_LOCAL from "../assets/branding/ministry-logo.png";


type DeletedSchool = {
  id:string;
  name:string;
  governorate:string;
  deletedAt:any;
  deleteExpiresAt:any;
};


const restoreSchool =
callFn<
 {tenantId:string},
 {ok:boolean}
>(
 "adminRestoreSchoolTenant"
);



const MINISTRY_LOGO = MINISTRY_LOGO_LOCAL;


const SCHOOL_ICON = SCHOOL_ICON_LOCAL;



function formatDate(value:any){

 try{

  if(value?.seconds){
   return new Date(
    value.seconds*1000
   ).toLocaleString("ar-OM");
  }

  return "-";

 }catch{

  return "-";

 }

}



export default function DeletedSchoolTenants(){

 const navigate = useNavigate();


 const [items,setItems]=useState<DeletedSchool[]>([]);
 const [loading,setLoading]=useState(true);

 const [restoreTarget,setRestoreTarget]=useState<DeletedSchool|null>(null);
 const [busy,setBusy]=useState(false);



 useEffect(()=>{

  async function load(){

   const snap =
   await getDocs(
    collection(
     db,
     "deletedSchoolTenants"
    )
   );


   setItems(
    snap.docs.map(d=>({

     id:d.id,
     ...(d.data() as any)

    }))
    .map((x:any)=>({

      id:x.id,

      name:
      x?.root?.name ||
      x?.meta?.schoolNameAr ||
      "-",

      governorate:
      x?.root?.governorate ||
      x?.meta?.governorate ||
      "-",

      deletedAt:x.deletedAt,
      deleteExpiresAt:x.deleteExpiresAt || x.restoreExpiresAt

    }))
   );


   setLoading(false);

  }


  load();


 },[]);




 async function confirmRestore(){

  if(!restoreTarget)return;


  try{

   setBusy(true);


   await restoreSchool({

    tenantId:restoreTarget.id

   });


   setRestoreTarget(null);


   location.reload();


  }catch(e){

   alert(
    "تعذر استعادة المدرسة"
   );

  }
  finally{

   setBusy(false);

  }

 }





 return (

 <div
 className="owner-diploma-centers"
 dir="rtl"
 >


 <header className="owner-diploma-centers__header">


 <div className="owner-diploma-centers__identity">

 <img src={MINISTRY_LOGO}/>

 <div>

 <strong>
 سلطنة عمان
 </strong>

 <span>
 وزارة التعليم
 </span>

 </div>

 </div>


 <div className="owner-diploma-centers__ownerBadge">
 مالك المنصة
 </div>


 </header>




 <main className="owner-diploma-centers__main">


 <div className="owner-diploma-centers__breadcrumb">

 <button
 onClick={()=>
 navigate("/system/management")
 }
 >
 الإدارة الرئيسية
 </button>


 <span>‹</span>


 <button
 onClick={()=>
 navigate("/system/management/schools")
 }
 >
 المدارس
 </button>


 <span>‹</span>


 <strong>
 المدارس المحذوفة
 </strong>


 </div>





 <section className="owner-diploma-centers__hero">


 <div className="owner-diploma-centers__heroIcon">

 <img src={SCHOOL_ICON}/>

 </div>


 <div>

 <p>
 المدارس
 </p>


 <h1>
 المدارس المحذوفة
 </h1>


 <span>
 عرض المدارس التي تم حذفها مؤقتاً مع معلومات فترة الاسترجاع.
 </span>


 </div>


 </section>





 <section className="owner-diploma-centers__tableSection">


 {
 loading ?

 <p>
 جاري التحميل...
 </p>

 :

 <table className="owner-diploma-centers__table">


 <thead>

 <tr>

 <th>
 المدرسة
 </th>

 <th>
 المحافظة
 </th>

 <th>
 Tenant ID
 </th>

 <th>
 تاريخ الحذف
 </th>

 <th>
 انتهاء الاسترجاع
 </th>

 <th>
 الإجراء
 </th>


 </tr>

 </thead>



 <tbody>


 {
 items.map(item=>(


 <tr key={item.id}>


 <td>
 {item.name}
 </td>


 <td>
 {item.governorate}
 </td>


 <td>
 {item.id}
 </td>


 <td>
  {formatDate(item.deletedAt)}
 </td>


 <td>
  {formatDate(item.deleteExpiresAt)}
 </td>



 <td>


 <button
 onClick={()=>
 setRestoreTarget(item)
 }
 >
 استعادة
 </button>


 </td>



 </tr>


 ))
 }



 {
 items.length===0 &&

 <tr>

 <td colSpan={5}>
 لا توجد مدارس محذوفة.
 </td>

 </tr>

 }


 </tbody>


 </table>

 }


 </section>






 {
 restoreTarget &&

 <div className="owner-restore-modal-overlay">


 <div className="owner-restore-modal">


 <h3>
 استعادة المدرسة
 </h3>


 <p>
 هل تريد استعادة:
 </p>


 <strong>
 {restoreTarget.name}
 </strong>



 <div>


 <button
 className="owner-restore-cancel"
 disabled={busy}
 onClick={()=>
 setRestoreTarget(null)
 }
 >
 إلغاء
 </button>



 <button
 className="owner-restore-confirm"
 disabled={busy}
 onClick={confirmRestore}
 >

 {
 busy
 ?
 "جاري الاستعادة..."
 :
 "تأكيد الاستعادة"
 }

 </button>


 </div>


 </div>


 </div>

 }



 </main>


 </div>


 );


}













