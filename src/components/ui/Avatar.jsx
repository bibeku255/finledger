import React from "react";

const Avatar = ({ src, name = "User", size = 60, badge = null, ring = true }) => {
  const fallback = name?.charAt(0)?.toUpperCase() || "U";

  return (
    <div
      style={{ width: size, height: size }}
      className={`relative flex items-center justify-center rounded-full ${
        ring ? "p-[2px] bg-gradient-to-tr from-blue-600 to-indigo-500" : ""
      }`}
    >
      <div className="w-full h-full rounded-full overflow-hidden bg-white dark:bg-slate-950 flex items-center justify-center">
        {src ? (
          <img
            src={src}
            alt="Avatar"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-sm font-black uppercase text-slate-500 dark:text-slate-300">
            {fallback}
          </span>
        )}
      </div>
      {badge && <div className="absolute -bottom-1 -right-1">{badge}</div>}
    </div>
  );
};

export default Avatar;