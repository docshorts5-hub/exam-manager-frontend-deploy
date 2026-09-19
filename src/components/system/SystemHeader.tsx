import React from "react";

type Props = {
  title:string;
  description:string;
  logo:string;
  onOwner:()=>void;
  onGateway:()=>void;
};

export default function SystemHeader({
  title,
  description,
  logo,
  onOwner,
  onGateway
}:Props){

  return (
    <header
      style={{
        padding:"18px 34px",
        marginBottom:22,
        position:"relative",
        background:"transparent",
        display:"grid",
        gridTemplateColumns:"1fr 1.5fr 1fr",
        alignItems:"center",
        gap:20,
        minHeight:150
      }}
    >

      <div
        style={{
          display:"flex",
          alignItems:"center",
          gap:16,
          justifyContent:"flex-start"
        }}
      >
        <img
  src={logo}
  alt="logo"
  style={{
    width: 72,
    height: 72,
    objectFit: "contain",
    display: "block",
    background: "transparent"
  }}
/>

        <div>
          <div style={{fontSize:18,fontWeight:900}}>
            سلطنة عمان
          </div>

          <div style={{fontSize:18,fontWeight:900}}>
            وزارة التعليم
          </div>
        </div>
      </div>


      <div style={{textAlign:"center"}}>
        <h1
          style={{
            margin:"0 0 10px",
            fontSize:44,
            fontWeight:1000,
            color:"#111827"
          }}
        >
          {title}
        </h1>

        <p
          style={{
            margin:0,
            fontSize:16,
            fontWeight:800,
            color:"#374151"
          }}
        >
          {description}
        </p>
      </div>


      <div
        style={{
          display:"flex",
          justifyContent:"flex-end",
          gap:12,
          flexWrap:"wrap"
        }}
      >

        <button
          className="phase50-btn"
          onClick={onOwner}
        >
          العودة إلى لوحة مالك المنصة
        </button>

        <button
          className="phase50-btn"
          onClick={onGateway}
        >
          العودة إلى البوابة التشغيلية
        </button>

      </div>

    </header>
  );}
