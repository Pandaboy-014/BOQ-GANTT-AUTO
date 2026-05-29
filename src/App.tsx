/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { View, ProjectInfo } from './types.ts';
import LoginView from './components/LoginView.tsx';
import SignupView from './components/SignupView.tsx';
import DashboardView from './components/DashboardView.tsx';
import ProjectDetailView from './components/ProjectDetailView.tsx';
import AddProjectView from './components/AddProjectView.tsx';
import ProfileView from './components/ProfileView.tsx';
import { auth, db } from './lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, query, where, onSnapshot, doc, setDoc, getDoc, or } from 'firebase/firestore';
import OrientationOverlay from './components/OrientationOverlay.tsx';
import ToastContainer from './components/Toast.tsx';
import { showToast, showErrorToast } from './lib/toast.ts';


export default function App() {
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<'manager' | 'engineer' | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [currentView, setCurrentView] = useState<View>('login');
  const [selectedProject, setSelectedProject] = useState<ProjectInfo | null>(null);
  const [editingProject, setEditingProject] = useState<ProjectInfo | null>(null);
  const [projectsList, setProjectsList] = useState<ProjectInfo[]>([]);
  const [selectedProvince, setSelectedProvince] = useState<string>('');
  const [dbError, setDbError] = useState<boolean>(false);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as any });
  }, [currentView, selectedProject]);

  useEffect(() => {
    let active = true;

    // Safety watchdog timer (5 seconds max waiting for Firebase)
    const safetyTimeout = setTimeout(() => {
      if (active && !authReady) {
        console.warn("Safety trigger: App loading timed out. Loading fallback screen.");
        setDbError(true);
        setAuthReady(true);
        // Fallback checks
        if (!user) {
          setCurrentView('login');
        } else if (!userRole) {
          setUserRole('engineer');
          setCurrentView('dashboard');
        }
      }
    }, 5000);

    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (!active) return;
      setUser(u);
      if (u) {
        try {
          // Fetch role from Firestore with a 4s Promise.race timeout
          const docRef = doc(db, 'users', u.uid);
          let docSnap;
          try {
            docSnap = await Promise.race([
              getDoc(docRef),
              new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timeout getting user profile")), 4000))
            ]);
            // If we successfully fetched docSnap (regardless of if it exists or not), 
            // Firestore connection is healthy and functional.
            setDbError(false);
          } catch (fetchErr: any) {
            console.error("Real connection error or timeout fetching profile:", fetchErr);
            setDbError(true);
            // Fallback for visual access while database issue is unresolved
            setUserRole('engineer');
            setCurrentView('dashboard');
            setAuthReady(true);
            clearTimeout(safetyTimeout);
            return;
          }

          if (docSnap && docSnap.exists()) {
            setUserRole(docSnap.data().role || 'engineer');
            setCurrentView('dashboard');
            setDbError(false);
          } else {
            // Document doesn't exist yet - which is normal for a brand new user.
            // Setup default profile for ANY authenticated user to integrate them instantly.
            const defaultRole = 'engineer';
            const newUserProfile = {
              name: u.displayName || u.email?.split('@')[0] || 'User',
              email: u.email || '',
              role: defaultRole,
              avatarUrl: u.photoURL || '',
              createdAt: new Date().toISOString()
            };

            try {
              await Promise.race([
                setDoc(doc(db, 'users', u.uid), newUserProfile),
                new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timeout setting user profile")), 4000))
              ]);
              setUserRole(defaultRole);
              setCurrentView('dashboard');
              setDbError(false);
            } catch (createErr: any) {
              console.error("Real connection error or timeout creating profile:", createErr);
              setDbError(true);
              // Fallback for visual access
              setUserRole(defaultRole);
              setCurrentView('dashboard');
            }
          }
        } catch (err) {
          console.error("Unexpected error in profile setup process:", err);
          setDbError(true);
          setUserRole('engineer');
          setCurrentView('dashboard');
        }
      } else {
        setUserRole(null);
        setCurrentView('login');
        setDbError(false);
      }
      setAuthReady(true);
      clearTimeout(safetyTimeout);
    });

    return () => {
      active = false;
      unsubscribe();
      clearTimeout(safetyTimeout);
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setProjectsList([]);
      return;
    }

    // Fetch projects where user is owner OR a member
    const projectsRef = collection(db, 'projects');
    const q = query(
      projectsRef, 
      or(
        where('ownerId', '==', user.uid),
        where('memberIds', 'array-contains', user.uid)
      )
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const projects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProjectInfo));
      setProjectsList(projects);
      setDbError(false);
    }, (error) => {
      console.error("Firestore onSnapshot error:", error);
      setDbError(true);
    });

    return () => unsubscribe();
  }, [user]);

  const handleLogout = async () => {
    await signOut(auth);
  };

  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  const handleProjectSelect = (project: ProjectInfo) => {
    setSelectedProject(project);
    setCurrentView('project-detail');
  };

  const handleEditProject = (project: ProjectInfo) => {
    setEditingProject(project);
    setCurrentView('add-project');
  };

  const handleAddProject = async (project: ProjectInfo) => {
    if (!user) return;

    try {
      const isEdit = !!editingProject;
      let finalProject: ProjectInfo;
      
      if (isEdit) {
        finalProject = {
          ...project,
          ownerId: project.ownerId || editingProject!.ownerId || user.uid,
          memberIds: project.memberIds || []
        };
        
        // Optimistically update project in state instantly
        setProjectsList(prev => prev.map(p => p.id === finalProject.id ? finalProject : p));
      } else {
        const newId = project.id || Math.random().toString(36).substr(2, 9);
        finalProject = {
          ...project,
          id: newId,
          ownerId: user.uid,
          memberIds: []
        };
        
        // Optimistically append new project to state instantly
        setProjectsList(prev => {
          if (prev.some(p => p.id === finalProject.id)) return prev;
          return [...prev, finalProject];
        });
      }

      if (isEdit) {
        await setDoc(doc(db, 'projects', project.id), finalProject, { merge: true });
        setEditingProject(null);
        showToast("แก้ไขโครงการสำเร็จ", "success");
      } else {
        const newProjectRef = doc(db, 'projects', finalProject.id);
        await setDoc(newProjectRef, finalProject);
        showToast("เพิ่มโครงการสำเร็จ", "success");
      }
      setCurrentView('dashboard');
    } catch (error) {
      showErrorToast(error, "บันทึกโครงการไม่สำเร็จ");
      throw error;
    }
  };

  const handleDeleteProject = async (project: ProjectInfo) => {
    try {
      // Optimistically remove project from state instantly
      setProjectsList(prev => prev.filter(p => p.id !== project.id));
      setEditingProject(null);
      setCurrentView('dashboard');

      const { writeBatch, collection, getDocs } = await import('firebase/firestore');
      const batch = writeBatch(db);
      
      const tasksSnap = await getDocs(collection(db, 'projects', project.id, 'tasks'));
      tasksSnap.docs.forEach((t) => {
        batch.delete(t.ref);
      });
      
      batch.delete(doc(db, 'projects', project.id));
      
      await batch.commit();
      showToast("ลบโครงการเรียบร้อยแล้ว", "success");
    } catch (err: any) {
      console.error("Error deleting project:", err);
      showErrorToast(err, "ไม่สามารถลบโครงการได้");
      throw err;
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans overflow-x-hidden">
      {dbError && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 text-amber-300 px-6 py-3 text-center text-xs font-light uppercase tracking-widest flex items-center justify-center gap-3 animate-pulse sticky top-0 z-50 backdrop-blur-md">
          <span className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-pulse mr-1" />
          ⚠️ เชื่อมต่อฐานข้อมูลไม่ได้ (ขณะนี้ระบบสลับมาใช้พื้นที่สำรองและเซสชันออฟไลน์ เรียบร้อยแล้ว)
        </div>
      )}
      <AnimatePresence mode="wait">
        {currentView === 'login' && (
          <motion.div
            key="login"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            <LoginView 
              onNavigateSignup={() => setCurrentView('signup')}
            />
          </motion.div>
        )}

        {currentView === 'signup' && (
          <motion.div
            key="signup"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            <SignupView 
              onNavigateLogin={() => setCurrentView('login')}
            />
          </motion.div>
        )}

        {currentView === 'dashboard' && (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.4 }}
          >
            <DashboardView 
              projects={projectsList}
              onSelectProject={handleProjectSelect}
              onEditProject={handleEditProject}
              onAddProject={() => {
                setEditingProject(null);
                setCurrentView('add-project');
              }}
              onLogout={handleLogout}
              onNavigateProfile={() => setCurrentView('profile')}
              userRole={userRole}
              selectedProvince={selectedProvince}
              onSelectProvince={setSelectedProvince}
            />
          </motion.div>
        )}

        {currentView === 'profile' && (
          <motion.div
            key="profile"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.4 }}
          >
            <ProfileView onBack={() => setCurrentView('dashboard')} />
          </motion.div>
        )}

        {currentView === 'add-project' && (
          <motion.div
            key="add-project"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
          >
            <AddProjectView 
              onSave={handleAddProject}
              onCancel={() => {
                setEditingProject(null);
                setCurrentView('dashboard');
              }}
              onDelete={handleDeleteProject}
              projectToEdit={editingProject}
            />
          </motion.div>
        )}

        {currentView === 'project-detail' && selectedProject && (
          <motion.div
            key="project-detail"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.4 }}
          >
            <ProjectDetailView 
              project={selectedProject}
              onBack={() => setCurrentView('dashboard')} 
              userRole={userRole}
            />
          </motion.div>
        )}
      </AnimatePresence>
      <OrientationOverlay />
      <ToastContainer />
    </div>
  );
}
