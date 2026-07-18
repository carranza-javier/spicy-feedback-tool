var o="spicy_admin_jwt",n=(t,e)=>{let r=sessionStorage.getItem(o);return e(r?t.clone({setHeaders:{Authorization:`Bearer ${r}`}}):t)};export{o as a,n as b};
