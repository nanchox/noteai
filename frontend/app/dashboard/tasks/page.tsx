"use client";
import { useEffect, useState } from "react";
import { tasksApi, projectsApi } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { Plus, Check, Trash2, Calendar, Flag, List, Kanban } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import clsx from "clsx";

const PRIORITY_COLORS: Record<string,string> = {
  urgent:"text-red-400 border-red-400/30", high:"text-orange-400 border-orange-400/30",
  medium:"text-indigo-400 border-indigo-400/30", low:"text-gray-400 border-gray-600",
};
const PRIORITY_LABELS: Record<string,string> = {urgent:"Urgente",high:"Alta",medium:"Media",low:"Baja"};
const COLUMNS = [
  {id:"todo",label:"Por hacer",dot:"bg-primary"},
  {id:"in_progress",label:"En progreso",dot:"bg-warning"},
  {id:"done",label:"Hecho",dot:"bg-success"},
];
const taskToCol = (t:any) => t.is_completed?"done":t.kanban_status==="in_progress"?"in_progress":"todo";

export default function TasksPage() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [view, setView] = useState<"list"|"kanban">("list");
  const [showForm, setShowForm] = useState(false);
  const [filterCompleted, setFilterCompleted] = useState(false);
  const [activeProject, setActiveProject] = useState<string|null>(null);
  const [form, setForm] = useState({title:"",description:"",priority:"medium",due_date:"",project_id:""});
  const [ready, setReady] = useState(false);
  const [dragging, setDragging] = useState<string|null>(null);
  const [addingTo, setAddingTo] = useState<string|null>(null);
  const [quickTitle, setQuickTitle] = useState("");

  useEffect(()=>{ supabase.auth.getSession().then(({data})=>{ if(data.session) setReady(true); }); },[]);

  const loadTasks = async() => {
    const [t,p] = await Promise.all([tasksApi.list({completed:view==="kanban"?undefined:filterCompleted, project_id:activeProject||undefined}), projectsApi.list()]);
    setTasks(t); setProjects(p);
  };

  useEffect(()=>{ if(ready) loadTasks(); },[ready,filterCompleted,activeProject,view]);

  const createTask = async() => {
    if(!form.title.trim()) return;
    await tasksApi.create({...form, due_date:form.due_date||null, project_id:form.project_id||null});
    setForm({title:"",description:"",priority:"medium",due_date:"",project_id:""}); setShowForm(false); loadTasks();
  };

  const toggleComplete = async(task:any)=>{ await tasksApi.update(task.id,{is_completed:!task.is_completed}); loadTasks(); };
  const deleteTask = async(id:string)=>{ await tasksApi.delete(id); setTasks(prev=>prev.filter(t=>t.id!==id)); };

  // Kanban
  const moveTask = async(taskId:string,toCol:string)=>{
    const update:any={};
    if(toCol==="done"){update.is_completed=true;update.completed_at=new Date().toISOString();}
    else{update.is_completed=false;update.completed_at=null;update.kanban_status=toCol==="in_progress"?"in_progress":null;}
    setTasks(prev=>prev.map(t=>t.id===taskId?{...t,...update}:t));
    await tasksApi.update(taskId,update);
  };

  const addQuickTask = async(col:string)=>{
    if(!quickTitle.trim()){setAddingTo(null);return;}
    const t=await tasksApi.create({title:quickTitle.trim(),priority:"medium",is_completed:col==="done",kanban_status:col==="in_progress"?"in_progress":null});
    setTasks(prev=>[t,...prev]); setQuickTitle(""); setAddingTo(null);
  };

  return (
    <div className="flex flex-col h-full animate-fade-in">
      {/* Header */}
      <div className="px-4 md:px-6 py-4 border-b border-surface-border flex items-center gap-3 flex-wrap shrink-0">
        <div className="flex-1">
          <h1 className="text-lg font-bold" style={{color:"var(--color-text)"}}>Tareas</h1>
        </div>

        {/* Toggle lista/kanban */}
        <div className="flex bg-surface border border-surface-border rounded-lg p-0.5">
          <button onClick={()=>setView("list")}
            className={clsx("flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
              view==="list"?"bg-primary/20 text-primary-light":"text-gray-500 hover:text-white")}>
            <List className="w-3.5 h-3.5"/> Lista
          </button>
          <button onClick={()=>setView("kanban")}
            className={clsx("flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
              view==="kanban"?"bg-primary/20 text-primary-light":"text-gray-500 hover:text-white")}>
            <Kanban className="w-3.5 h-3.5"/> Kanban
          </button>
        </div>

        <button onClick={()=>setShowForm(v=>!v)}
          className="flex items-center gap-1.5 bg-primary hover:bg-primary-dark text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors">
          <Plus className="w-4 h-4"/> Nueva
        </button>
      </div>

      {/* Formulario */}
      {showForm && (
        <div className="px-4 md:px-6 py-4 border-b border-surface-border animate-slide-up">
          <div className="bg-surface-card border border-primary/20 rounded-xl p-4 space-y-3 max-w-2xl">
            <input type="text" placeholder="Título de la tarea *" value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))}
              autoFocus className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50" style={{color:"var(--color-text)"}}/>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <select value={form.priority} onChange={e=>setForm(f=>({...f,priority:e.target.value}))}
                className="bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm focus:outline-none" style={{color:"var(--color-text)"}}>
                <option value="low">Baja</option><option value="medium">Media</option><option value="high">Alta</option><option value="urgent">Urgente</option>
              </select>
              <input type="date" value={form.due_date} onChange={e=>setForm(f=>({...f,due_date:e.target.value}))}
                className="bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm focus:outline-none" style={{color:"var(--color-text)"}}/>
              <select value={form.project_id} onChange={e=>setForm(f=>({...f,project_id:e.target.value}))}
                className="col-span-2 bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm focus:outline-none" style={{color:"var(--color-text)"}}>
                <option value="">Sin proyecto</option>
                {projects.map(p=><option key={p.id} value={p.id}>{p.icon} {p.name}</option>)}
              </select>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={()=>setShowForm(false)} className="text-sm px-3 py-2" style={{color:"var(--color-text-subtle)"}}>Cancelar</button>
              <button onClick={createTask} className="bg-primary hover:bg-primary-dark text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
                Crear tarea
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Vista Lista ── */}
      {view==="list" && (
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {/* Filtros */}
          <div className="flex gap-2 flex-wrap mb-4">
            {[{v:false,l:"Pendientes"},{v:true,l:"Completadas"}].map(({v,l})=>(
              <button key={l} onClick={()=>setFilterCompleted(v)}
                className={clsx("text-xs px-3 py-1.5 rounded-full border transition-colors",
                  filterCompleted===v?"bg-primary/20 border-primary/50 text-primary-light":"border-surface-border hover:text-white")}
                style={filterCompleted!==v?{color:"var(--color-text-muted)"}:{}}>{l}</button>
            ))}
            {projects.map(p=>(
              <button key={p.id} onClick={()=>setActiveProject(activeProject===p.id?null:p.id)}
                className={clsx("text-xs px-3 py-1.5 rounded-full border transition-colors",
                  activeProject===p.id?"bg-primary/20 border-primary/50 text-primary-light":"border-surface-border hover:text-white")}
                style={activeProject!==p.id?{color:"var(--color-text-muted)"}:{}}>
                {p.icon} {p.name}
              </button>
            ))}
          </div>

          <div className="space-y-2 max-w-2xl">
            {tasks.length===0 && <p className="text-sm text-center py-10" style={{color:"var(--color-text-subtle)"}}>{filterCompleted?"Sin completadas":"Sin pendientes 🎉"}</p>}
            {tasks.map(task=>(
              <div key={task.id} className={clsx("bg-surface-card border rounded-xl p-4 flex items-start gap-3 group transition-colors",
                task.is_completed?"border-surface-border opacity-60":"border-surface-border hover:border-primary/20")}>
                <button onClick={()=>toggleComplete(task)}
                  className={clsx("mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                    task.is_completed?"bg-success border-success":"border-gray-600 hover:border-success")}>
                  {task.is_completed&&<Check className="w-3 h-3 text-white"/>}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={clsx("text-sm font-medium",task.is_completed?"line-through text-gray-500":"")} style={!task.is_completed?{color:"var(--color-text)"}:{}}>{task.title}</p>
                  <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                    <span className={clsx("text-xs border px-2 py-0.5 rounded-full",PRIORITY_COLORS[task.priority])}>
                      <Flag className="w-2.5 h-2.5 inline mr-0.5"/>{PRIORITY_LABELS[task.priority]}
                    </span>
                    {task.due_date&&(
                      <span className={clsx("text-xs flex items-center gap-1",new Date(task.due_date)<new Date()&&!task.is_completed?"text-danger":"text-gray-400")}>
                        <Calendar className="w-3 h-3"/>{format(new Date(task.due_date),"d MMM",{locale:es})}
                      </span>
                    )}
                    {task.projects&&<span className="text-xs text-gray-500">{task.projects.icon} {task.projects.name}</span>}
                  </div>
                </div>
                <button onClick={()=>deleteTask(task.id)} className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-500 hover:text-danger rounded-lg transition-all">
                  <Trash2 className="w-4 h-4"/>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Vista Kanban ── */}
      {view==="kanban" && (
        <div className="flex-1 overflow-x-auto p-4 md:p-6">
          <div className="flex gap-4 h-full min-w-max md:min-w-0">
            {COLUMNS.map(col=>{
              const colTasks = tasks.filter(t=>taskToCol(t)===col.id);
              return (
                <div key={col.id} className="flex flex-col w-72 md:flex-1 border border-surface-border rounded-xl overflow-hidden"
                  style={{backgroundColor:"var(--color-surface-card)"}}
                  onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();if(dragging)moveTask(dragging,col.id);setDragging(null);}}>
                  <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${col.dot}`}/>
                      <span className="text-sm font-semibold" style={{color:"var(--color-text)"}}>{col.label}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-surface" style={{color:"var(--color-text-subtle)"}}>{colTasks.length}</span>
                    </div>
                    <button onClick={()=>{setAddingTo(col.id);setQuickTitle("");}}
                      className="w-6 h-6 rounded-md flex items-center justify-center text-gray-500 hover:text-white hover:bg-surface-hover transition-colors">
                      <Plus className="w-3.5 h-3.5"/>
                    </button>
                  </div>

                  {addingTo===col.id&&(
                    <div className="p-3 border-b border-surface-border">
                      <input autoFocus value={quickTitle} onChange={e=>setQuickTitle(e.target.value)}
                        onKeyDown={e=>{if(e.key==="Enter")addQuickTask(col.id);if(e.key==="Escape")setAddingTo(null);}}
                        placeholder="Título de la tarea..."
                        className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50" style={{color:"var(--color-text)"}}/>
                      <div className="flex gap-2 mt-2">
                        <button onClick={()=>addQuickTask(col.id)} className="text-xs bg-primary hover:bg-primary-dark text-white px-3 py-1.5 rounded-lg transition-colors">Agregar</button>
                        <button onClick={()=>setAddingTo(null)} className="text-xs px-2 py-1.5" style={{color:"var(--color-text-subtle)"}}>Cancelar</button>
                      </div>
                    </div>
                  )}

                  <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {colTasks.length===0&&addingTo!==col.id&&<p className="text-center py-6 text-xs" style={{color:"var(--color-text-subtle)"}}>Sin tareas</p>}
                    {colTasks.map(task=>(
                      <div key={task.id} draggable onDragStart={()=>setDragging(task.id)} onDragEnd={()=>setDragging(null)}
                        className={clsx("border border-surface-border rounded-xl p-3 cursor-grab active:cursor-grabbing hover:border-primary/20 transition-all group",
                          dragging===task.id?"opacity-40":"")}
                        style={{backgroundColor:"var(--color-surface)"}}>
                        <p className={clsx("text-sm font-medium mb-2",task.is_completed?"line-through text-gray-500":"")} style={!task.is_completed?{color:"var(--color-text)"}:{}}>{task.title}</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={clsx("text-xs border px-1.5 py-0.5 rounded-full",PRIORITY_COLORS[task.priority])}>
                            <Flag className="w-2.5 h-2.5 inline mr-0.5"/>{PRIORITY_LABELS[task.priority]}
                          </span>
                          {task.due_date&&<span className={clsx("text-xs",new Date(task.due_date)<new Date()&&!task.is_completed?"text-danger":"text-gray-500")}>{format(new Date(task.due_date),"d MMM",{locale:es})}</span>}
                        </div>
                        <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {COLUMNS.filter(c=>c.id!==col.id).map(c=>(
                            <button key={c.id} onClick={()=>moveTask(task.id,c.id)}
                              className="text-xs px-2 py-1 rounded-lg border border-surface-border hover:border-primary/30 transition-colors" style={{color:"var(--color-text-muted)"}}>
                              → {c.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
