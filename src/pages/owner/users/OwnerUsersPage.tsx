import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {useAdminUsers} from "../../../features/system-admin/hooks/useAdminUsers";
import { OWNER_MINISTRY_LOGO_URL } from "../OwnerDashboardShell";

import UserStatsCards from "./components/UserStatsCards";
import UserFilters from "./components/UserFilters";
import UsersTable from "./components/UsersTable";
import AddSupervisorDrawer from "./components/AddSupervisorDrawer";

import "./ownerUsers.css";


const normalize = (value:any)=>
 String(value || "")
 .trim()
 .toLowerCase();


export default function OwnerUsersPage(){

 const navigate = useNavigate();

 const {
  users,
 } = useAdminUsers();


 const allUsers =
 users || [];


 const [search,setSearch] =
 useState("");

 const [addOpen,setAddOpen] =
 useState(false);
  // OWNER_USERS_AUTO_OPEN_ADD_SUPERVISOR
  useEffect(() => {
    const params =
      new URLSearchParams(
        window.location.search
      );

    if (
      params.get("addSupervisor") !== "1"
    ) {
      return;
    }

    setAddOpen(true);

    params.delete("addSupervisor");

    const query = params.toString();

    const nextUrl =
      window.location.pathname +
      (query ? `?${query}` : "") +
      window.location.hash;

    window.history.replaceState(
      window.history.state,
      "",
      nextUrl
    );
  }, []);



 const filteredUsers =
 useMemo(()=>{

  const q =
  normalize(search);


  if(!q){
   return allUsers;
  }


  return allUsers.filter(
   (user:any)=>
    [
     user?.name,
     user?.email,
     user?.role,
     user?.governorate,
     user?.tenantId,
    ]
    .map(normalize)
    .join(" ")
    .includes(q)
  );


 },[
  allUsers,
  search,
 ]);



 return (

 <div
 className="owner-users"
 dir="rtl"
 >


 <header
className="owner-users__header"
>

<div
className="owner-users__brand"
>

<img
src={OWNER_MINISTRY_LOGO_URL}
className="owner-users__logo"
alt="شعار وزارة التعليم"
/>

<div
className="owner-users__ministry"
>

<strong>
سلطنة عمان
</strong>

<span>
وزارة التعليم
</span>

</div>

</div>


<div
className="owner-users__hero"
>

<h1>
إدارة المستخدمين والصلاحيات
</h1>

<p>
الحسابات الإشرافية وربطها بالنطاق الصحيح
</p>

</div>


<div
className="owner-users__actions"
>

<button
 type="button"
 className="owner-users__platform"
 onClick={()=>{
   setAddOpen(false);
   navigate("/system/management");
 }}
>
 مشرف المنصة
</button>


<button
type="button"
className="owner-users__action"
onClick={()=>setAddOpen(true)}
>
+ إضافة مشرف
</button>

</div>


</header>
<nav
 className="owner-users__breadcrumbRow"
 aria-label="مسار التنقل"
>
 <div className="owner-users__breadcrumb">

  <button
   type="button"
   onClick={()=>navigate("/system")}
  >
   الرئيسية
  </button>

  <b aria-hidden="true">←</b>

  <button
   type="button"
   onClick={()=>navigate("/system/management")}
  >
   الإدارة الرئيسية
  </button>

  <b aria-hidden="true">←</b>

  <strong>
   إدارة المستخدمين
  </strong>

 </div>
</nav>




 <main
 className="owner-users__main"
 >


 <UserStatsCards
 users={allUsers}
 />


 <UserFilters
 search={search}
 onSearchChange={setSearch}

 />


 <UsersTable
 users={filteredUsers}
 />


 </main>



 <AddSupervisorDrawer
 open={addOpen}
 onClose={()=>setAddOpen(false)}
 users={allUsers}
 />


 </div>

 );

}





