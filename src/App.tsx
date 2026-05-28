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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // Fetch role from Firestore
        const docRef = doc(db, 'users', u.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setUserRole(docSnap.data().role);
          setCurrentView('dashboard');
        } else {
          // If no profile, we need to let them pick a role (could redirect to a simple role picker or setup default)
          // For now, let's setup a simplified profile for Google users
          if (u.providerData.some(p => p.providerId === 'google.com')) {
            // New Google user - we'll let them settle in as engineer by default or show a choice
            // Let's actually redirect to a "complete profile" state if we had one, 
            // but to keep it simple, we'll set a default role and they can change it in Profile
            const defaultRole = 'engineer';
            await setDoc(doc(db, 'users', u.uid), {
              name: u.displayName || 'Google User',
              email: u.email || '',
              role: defaultRole,
              avatarUrl: u.photoURL || '',
              createdAt: new Date().toISOString()
            });
            setUserRole(defaultRole);
            setCurrentView('dashboard');
          } else {
            setCurrentView('login');
          }
        }
      } else {
        setUserRole(null);
        setCurrentView('login');
      }
      setAuthReady(true);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setProjectsList([]);
      return;
    }

    // Fixed query: Fetch projects where user is owner OR a member
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
    }, (error) => {
      console.error("Firestore error:", error);
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
      if (editingProject) {
        await setDoc(doc(db, 'projects', project.id), {
          ...project,
          ownerId: project.ownerId || editingProject.ownerId || user.uid,
          memberIds: project.memberIds || []
        }, { merge: true });
        setEditingProject(null);
        showToast("แก้ไขโครงการสำเร็จ", "success");
      } else {
        const newProjectRef = doc(collection(db, 'projects'));
        await setDoc(newProjectRef, {
          ...project,
          id: newProjectRef.id,
          ownerId: user.uid,
          memberIds: []
        });
        showToast("เพิ่มโครงการสำเร็จ", "success");
      }
      setCurrentView('dashboard');
    } catch (error) {
      showErrorToast(error, "บันทึกโครงการไม่สำเร็จ");
    }
  };

  const handleDeleteProject = async (project: ProjectInfo) => {
    try {
      const { writeBatch, collection, getDocs } = await import('firebase/firestore');
      const batch = writeBatch(db);
      
      const tasksSnap = await getDocs(collection(db, 'projects', project.id, 'tasks'));
      tasksSnap.docs.forEach((t) => {
        batch.delete(t.ref);
      });
      
      batch.delete(doc(db, 'projects', project.id));
      
      await batch.commit();
      showToast("ลบโครงการเรียบร้อยแล้ว", "success");
      setEditingProject(null);
      setCurrentView('dashboard');
    } catch (err: any) {
      console.error("Error deleting project:", err);
      showErrorToast(err, "ไม่สามารถลบโครงการได้");
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans overflow-x-hidden">
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
