'use client';
import {useEffect,useState,createContext,useContext} from 'react';
import {Moon,Sun} from 'lucide-react';
const Context=createContext();
export function ThemeProvider({children}){const [dark,setDark]=useState(false);useEffect(()=>{setDark(localStorage.getItem('ud-theme')==='dark'||(!localStorage.getItem('ud-theme')&&matchMedia('(prefers-color-scheme: dark)').matches));},[]);useEffect(()=>{document.documentElement.dataset.theme=dark?'dark':'light';},[dark]);function toggle(){setDark(v=>{localStorage.setItem('ud-theme',v?'light':'dark');return !v;});}return <Context.Provider value={{dark,toggle}}>{children}</Context.Provider>;}
export function ThemeToggle(){const{dark,toggle}=useContext(Context);return <button className="icon-button" onClick={toggle} aria-label={`Switch to ${dark?'light':'dark'} mode`}>{dark?<Sun size={19}/>:<Moon size={19}/>}</button>;}
