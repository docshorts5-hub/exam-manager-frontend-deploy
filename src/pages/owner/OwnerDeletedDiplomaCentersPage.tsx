import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Navigate,
  useNavigate,
} from "react-router-dom";

import { useAuth } from "../../auth/AuthContext";

import {
  buildAuthzSnapshot,
  isPlatformOwner,
} from "../../features/authz";

import { callFn } from "../../services/functionsClient";

import "./ownerDiplomaCenters.css";


type LoadState =
  | "loading"
  | "ready"
  | "error";


type DeletedDiplomaCenterItem = {
  id: string;
  name: string;
  governorate: string;
  deletedAt: unknown;
  deleteExpiresAt: unknown;
  deletedBy: string;
};


const MINISTRY_LOGO =
  "https://i.postimg.cc/j5G4NQvZ/sh%CA%BFar-1.png";


const DIPLOMA_CENTER_ICON =
  "https://i.postimg.cc/YC9R5944/352d2558-14ff-434e-821d-3ffad98df2c4.jpg";


const listDeletedDiplomaCenters =
  callFn<
    Record<string, never>,
    {
      items: DeletedDiplomaCenterItem[];
    }
  >(
    "adminListDeletedDiplomaCenters",
  );


const restoreDeletedDiplomaCenter =
  callFn<
    {
      id: string;
    },
    {
      ok: boolean;
      id: string;
      correlationId?: string;
    }
  >(
    "adminRestoreDeletedDiplomaCenter",
  );


function formatDate(value: unknown): string {

  try {

    if(!value){
      return "-";
    }


    let milliseconds:number | null = null;


    if(
      typeof value === "object"
    ){

      const x:any = value;


      if(
        typeof x.seconds === "number"
      ){
        milliseconds =
          x.seconds * 1000;
      }


      if(
        typeof x._seconds === "number"
      ){
        milliseconds =
          x._seconds * 1000;
      }

    }


    if(milliseconds !== null){

      return new Date(
        milliseconds
      ).toLocaleString(
        "ar-OM",
        {
          year:"numeric",
          month:"2-digit",
          day:"2-digit",
          hour:"2-digit",
          minute:"2-digit",
        }
      );

    }


    const date =
      new Date(
        value as any
      );


    if(
      Number.isNaN(
        date.getTime()
      )
    ){
      return "-";
    }


    return date.toLocaleString(
      "ar-OM",
      {
        year:"numeric",
        month:"2-digit",
        day:"2-digit",
        hour:"2-digit",
        minute:"2-digit",
      }
    );


  }catch{

    return "-";

  }

}

export default function OwnerDeletedDiplomaCentersPage(){

  const navigate = useNavigate();

  const auth =
    useAuth() as any;


  const authzSnapshot =
    useMemo(
      () =>
        buildAuthzSnapshot(auth),
      [auth],
    );


  const owner =
    isPlatformOwner(
      authzSnapshot,
    );


  const [items,setItems] =
    useState<
      DeletedDiplomaCenterItem[]
    >([]);


  const [loadState,setLoadState] =
    useState<LoadState>(
      "loading",
    );


  const [loadError,setLoadError] =
    useState("");


  const [reloadSequence,setReloadSequence] =
    useState(0);


  const [restoreTarget,setRestoreTarget] =
    useState<DeletedDiplomaCenterItem | null>(
      null
    );


  const [restoreLoading,setRestoreLoading] =
    useState(false);


  const [restoreMessage,setRestoreMessage] =
    useState("");


  useEffect(()=>{

    if(!owner){

      setLoadState("error");

      setLoadError(
        "هذه الصفحة مخصصة لمالك المنصة فقط.",
      );

      return;

    }


    let active=true;


    setLoadState(
      "loading",
    );


    void listDeletedDiplomaCenters({})
      .then((response)=>{

        if(!active)return;


        setItems(
          response.items || [],
        );


        setLoadState(
          "ready",
        );

      })
      .catch(()=>{

        if(!active)return;


        setItems([]);


        setLoadState(
          "error",
        );


        setLoadError(
          "تعذر تحميل المراكز المحذوفة.",
        );

      });


    return ()=>{

      active=false;

    };


  },[
    owner,
    reloadSequence,
  ]);


  const handleRestore =
    (
      item: DeletedDiplomaCenterItem,
    ) => {

      setRestoreMessage("");

      setRestoreTarget(
        item,
      );

    };


  const confirmRestore =
    async () => {

      if(!restoreTarget){
        return;
      }


      try {

        setRestoreLoading(true);

        setRestoreMessage("");


        await restoreDeletedDiplomaCenter({
          id: restoreTarget.id,
        });


        setRestoreMessage(
          "تمت استعادة المركز بنجاح.",
        );


        setReloadSequence(
          value => value + 1,
        );


        setRestoreTarget(null);


      } catch {

        setRestoreMessage(
          "تعذر استعادة المركز.",
        );


      } finally {

        setRestoreLoading(false);

      }

    };



  if(!owner){

    return (
      <Navigate
        to="/system"
        replace
      />
    );

  }



  return (

    <div
      className="owner-diploma-centers"
      dir="rtl"
    >


      <header className="owner-diploma-centers__header">

        <div className="owner-diploma-centers__identity">

          <img
            src={MINISTRY_LOGO}
            alt="شعار وزارة التعليم"
          />

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
            type="button"
            onClick={()=>
              navigate(
                "/system/management"
              )
            }
          >
            الإدارة الرئيسية
          </button>


          <span>
            ‹
          </span>


          <button
            type="button"
            onClick={()=>
              navigate(
                "/system/management/diploma-centers"
              )
            }
          >
            مراكز الدبلوم
          </button>


          <span>
            ‹
          </span>


          <strong>
            المراكز المحذوفة
          </strong>


        </div>




        <section className="owner-diploma-centers__hero">


          <div className="owner-diploma-centers__heroIcon">

            <img
              src={DIPLOMA_CENTER_ICON}
              alt=""
              aria-hidden="true"
            />

          </div>


          <div>

            <p>
              مراكز الدبلوم
            </p>


            <h1>
              المراكز المحذوفة
            </h1>


            <span>
              عرض المراكز التي تم حذفها مؤقتاً مع معلومات فترة الاسترجاع.
            </span>


          </div>


        </section>




        <section className="owner-diploma-centers__tableSection">


          {
            loadState==="loading" &&
            <p>
              جاري التحميل...
            </p>
          }



          {
            loadState==="error" &&
            <p>
              {loadError}
            </p>
          }



          {
            loadState==="ready" &&

            <table className="owner-diploma-centers__table">

              <thead>

                <tr>

                  <th>
                    المركز
                  </th>

                  <th>
                    المحافظة
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
                  items.map((item)=>(

                    <tr key={item.id}>

                      <td>
                        {item.name}
                      </td>


                      <td>
                        {item.governorate}
                      </td>


                      <td>
                        {formatDate(item.deletedAt)}
                      </td>


                      <td>
                        {formatDate(item.deleteExpiresAt)}
                      </td>


                      <td>

                        <button
                          type="button"
                          onClick={() =>
                            handleRestore(item)
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
                      لا توجد مراكز محذوفة.
                    </td>

                  </tr>
                }


              </tbody>


            </table>

          }


        </section>


        {
          restoreTarget &&
          <div
            className="owner-restore-modal-overlay"
          >

            <div
              className="owner-restore-modal"
            >

              <h3>
                استعادة مركز الدبلوم
              </h3>


              <p>
                هل تريد استعادة المركز:
              </p>


              <strong>
                {restoreTarget.name}
              </strong>


              <p>
                سيتم إعادة تفعيل المركز وإزالته من قائمة المراكز المحذوفة.
              </p>


              {
                restoreMessage &&
                <p>
                  {restoreMessage}
                </p>
              }


              <div>

                <button
                  type="button"
                  className="owner-restore-cancel"
                  disabled={restoreLoading}
                  onClick={() =>
                    setRestoreTarget(null)
                  }
                >
                  إلغاء
                </button>


                <button
                  type="button"
                  className="owner-restore-confirm"
                  disabled={restoreLoading}
                  onClick={confirmRestore}
                >

                  {
                    restoreLoading
                    ? "جاري الاستعادة..."
                    : "تأكيد الاستعادة"
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









