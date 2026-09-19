import React from "react";


type Props = {
 users:any[];
};


const normalize = (value:any)=>
 String(value || "")
 .trim()
 .toLowerCase();



export default function UserStatsCards({
 users,
}:Props){


 const all =
 users || [];



 const cards = [

  {
   title:"إجمالي المستخدمين",
   value:all.length,
  },


  {
   title:"مشرفو الوزارة",
   value:
   all.filter(
    (x:any)=>
    normalize(x.role)==="ministry_super"
   ).length,
  },


  {
   title:"مشرفو المحافظات",
   value:
   all.filter(
    (x:any)=>
    [
     "super",
     "super_regional",
     "regional_super",
    ].includes(
     normalize(x.role)
    )
   ).length,
  },


  {
   title:"مشرفو المدارس",
   value:
   all.filter(
    (x:any)=>
    [
     "tenant_admin",
     "admin",
    ].includes(
     normalize(x.role)
    )
   ).length,
  },


  {
   title:"مشرفو مراكز الدبلوم",
   value:
   all.filter(
    (x:any)=>
    normalize(x.role)==="exam_super"
   ).length,
  },


 ];



 return (

 <section
 style={{
  display:"grid",
  gridTemplateColumns:
  "repeat(auto-fit,minmax(180px,1fr))",
  gap:16,
 }}
 >


 {
 cards.map((card)=>(

 <article
 key={card.title}
 style={{
  background:"#fff",
  borderRadius:18,
  padding:20,
  border:
  "1px solid rgba(15,23,42,.08)",
  boxShadow:
  "0 8px 25px rgba(15,23,42,.05)",
 }}
 >


 <div
 style={{
  color:"#64748b",
  fontSize:14,
  marginBottom:10,
  fontWeight:700,
 }}
 >
 {card.title}
 </div>


 <strong
 style={{
  fontSize:30,
  color:"#17345f",
 }}
 >
 {card.value}
 </strong>


 </article>

 ))

 }


 </section>

 );

}
