// Application State
        let tasks = [];
        let currentFilter = 'all';
        let currentView = 'dashboard';
        let timerInterval = null;
        let timerSeconds = 1500; // 25 minutes
        let isDarkMode = false;
        let currentMonth = new Date().getMonth();
        let currentYear = new Date().getFullYear();
        let searchQuery = '';
        let draggedTaskId = null;
        let notificationInterval = null;
        let focusSession = null;
        let taskTimeTracker = {};
        let activeTaskTimer = null;
        let focusTimer = null;
        let pendingNotifications = [];
        
        // Settings
        let settings = {
            notifications: true,
            notificationAdvanceTime: 30, // minutes
            timerSound: true,
            autoTimeTracking: true,
            deleteConfirmation: true,
            celebration: true,
            defaultTimer: 25,
            defaultView: 'dashboard',
            colorTheme: 'blue'
        };

        // Color Themes
        const colorThemes = {
            blue: {
                primary: '#6366f1',
                primaryDark: '#4f46e5',
                secondary: '#8b5cf6'
            },
            emerald: {
                primary: '#10b981',
                primaryDark: '#059669',
                secondary: '#34d399'
            },
            sunset: {
                primary: '#f59e0b',
                primaryDark: '#d97706',
                secondary: '#f97316'
            },
            rose: {
                primary: '#ec4899',
                primaryDark: '#db2777',
                secondary: '#f472b6'
            },
            purple: {
                primary: '#8b5cf6',
                primaryDark: '#7c3aed',
                secondary: '#a855f7'
            },
            teal: {
                primary: '#14b8a6',
                primaryDark: '#0d9488',
                secondary: '#06b6d4'
            },
            red: {
                primary: '#ef4444',
                primaryDark: '#dc2626',
                secondary: '#f87171'
            },
            dark: {
                primary: '#374151',
                primaryDark: '#1f2937',
                secondary: '#6b7280'
            }
        };

        // Initialize Application
        document.addEventListener('DOMContentLoaded', function() {
            console.log('Initializing Enhanced FlowTask...');
            loadTasks();
            loadSettings();
            updateStats();
            renderTasks();
            renderCalendar();
            checkTheme();
            updateTimerDisplay();
            initializeNotificationSystem();
            requestNotificationPermission();
            updateTodaysFocus();
            console.log('Enhanced FlowTask ready!');
        });

        // Notification System
        function initializeNotificationSystem() {
            // Check for upcoming deadlines every minute
            notificationInterval = setInterval(checkUpcomingDeadlines, 60000);
            // Initial check
            checkUpcomingDeadlines();
        }

        function requestNotificationPermission() {
            if ('Notification' in window) {
                if (Notification.permission === 'default') {
                    Notification.requestPermission().then(permission => {
                        if (permission === 'granted') {
                            showNotification('Notifications activées pour FlowTask!', 'success');
                        }
                    });
                }
            }
        }

        function checkUpcomingDeadlines() {
            if (!settings.notifications) return;

            const now = new Date();
            const advanceTime = settings.notificationAdvanceTime * 60 * 1000; // Convert to milliseconds
            
            tasks.forEach(task => {
                if (task.completed || !task.deadline) return;

                const deadline = new Date(task.deadline);
                const timeUntilDeadline = deadline.getTime() - now.getTime();
                
                // Check if task is approaching deadline
                if (timeUntilDeadline > 0 && timeUntilDeadline <= advanceTime) {
                    const notificationKey = `${task.id}_${Math.floor(timeUntilDeadline / 60000)}`;
                    
                    if (!pendingNotifications.includes(notificationKey)) {
                        pendingNotifications.push(notificationKey);
                        showTaskDeadlineNotification(task, timeUntilDeadline);
                    }
                }
                
                // Check if task is overdue
                if (timeUntilDeadline < 0 && Math.abs(timeUntilDeadline) < 3600000) { // Within 1 hour of being overdue
                    const overdueKey = `overdue_${task.id}`;
                    if (!pendingNotifications.includes(overdueKey)) {
                        pendingNotifications.push(overdueKey);
                        showOverdueNotification(task);
                    }
                }
            });

            updateNotificationBadge();
        }

        function showTaskDeadlineNotification(task, timeUntilDeadline) {
            const minutes = Math.floor(timeUntilDeadline / 60000);
            const hours = Math.floor(minutes / 60);
            
            let timeText;
            if (hours > 0) {
                timeText = `${hours}h ${minutes % 60}min`;
            } else {
                timeText = `${minutes} minutes`;
            }

            const message = `⏰ Échéance dans ${timeText}: ${task.title}`;
            
            // Browser notification
            if (Notification.permission === 'granted') {
                new Notification('FlowTask - Échéance proche', {
                    body: message,
                    icon: '⏰',
                    tag: `deadline_${task.id}`
                });
            }

            // In-app notification
            showDeadlineNotification(message, task);
        }

        function showOverdueNotification(task) {
            const message = `🚨 Tâche en retard: ${task.title}`;
            
            if (Notification.permission === 'granted') {
                new Notification('FlowTask - Tâche en retard', {
                    body: message,
                    icon: '🚨',
                    tag: `overdue_${task.id}`
                });
            }

            showDeadlineNotification(message, task, 'overdue');
        }

        function showDeadlineNotification(message, task, type = 'warning') {
            const notification = document.getElementById('deadlineNotification');
            const content = document.getElementById('deadlineNotificationContent');
            
            content.innerHTML = `
                <div style="margin-bottom: 0.5rem;">
                    <strong>${message}</strong>
                </div>
                <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
                    <button onclick="viewTask(${task.id})" style="background: white; color: var(--warning); border: 1px solid white; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer;">Voir</button>
                    <button onclick="completeTask(${task.id})" style="background: rgba(255,255,255,0.2); color: white; border: 1px solid rgba(255,255,255,0.3); padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer;">Terminer</button>
                </div>
            `;
            
            if (type === 'overdue') {
                notification.style.background = 'var(--danger)';
            }
            
            notification.classList.add('show');
            
            // Auto-hide after 10 seconds
            setTimeout(() => {
                notification.classList.remove('show');
            }, 10000);
        }

        function closeDeadlineNotification() {
            document.getElementById('deadlineNotification').classList.remove('show');
        }

        function updateNotificationBadge() {
            const badge = document.getElementById('notificationBadge');
            const overdueTasks = tasks.filter(task => {
                if (task.completed || !task.deadline) return false;
                return new Date(task.deadline) < new Date();
            }).length;
            
            if (overdueTasks > 0) {
                badge.textContent = overdueTasks;
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        }

        function toggleNotificationPanel() {
            // Simple notification panel toggle - could be expanded
            const overdueTasks = tasks.filter(task => {
                if (task.completed || !task.deadline) return false;
                return new Date(task.deadline) < new Date();
            });
            
            if (overdueTasks.length > 0) {
                let message = `Vous avez ${overdueTasks.length} tâche(s) en retard:\n`;
                overdueTasks.slice(0, 3).forEach(task => {
                    message += `• ${task.title}\n`;
                });
                alert(message);
            } else {
                showNotification('Aucune tâche en retard! 🎉', 'success');
            }
        }

        // Enhanced Task Functions
        function addTask() {
            console.log('Adding enhanced task...');
            const title = document.getElementById('taskTitle').value.trim();
            const category = document.getElementById('taskCategory').value;
            const priority = document.getElementById('taskPriority').value;
            const deadline = document.getElementById('taskDeadline').value;
            const description = document.getElementById('taskDescription').value.trim();
            const recurring = document.getElementById('taskRecurring').value;
            const estimatedTime = document.getElementById('taskEstimatedTime').value;
            const tags = document.getElementById('taskTags').value.trim();
            
            if (!title) {
                showNotification('Veuillez entrer un titre pour la tâche', 'error');
                return;
            }
            
            const task = {
                id: Date.now(),
                title,
                category,
                priority,
                deadline,
                description,
                recurring,
                estimatedTime: estimatedTime ? parseInt(estimatedTime) : null,
                tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
                completed: false,
                createdAt: new Date().toISOString(),
                completedAt: null,
                lastRecurring: null,
                sortOrder: tasks.length,
                timeSpent: 0, // in seconds
                sessions: []
            };
            
            tasks.unshift(task);
            saveTasks();
            renderTasks();
            updateStats();
            updateTodaysFocus();
            clearForm();
            showNotification('Tâche ajoutée avec succès!', 'success');
        }

        function viewTask(taskId) {
            switchView('tasks');
            setTimeout(() => {
                const taskCard = document.querySelector(`[data-id="${taskId}"]`);
                if (taskCard) {
                    taskCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    taskCard.style.background = 'rgba(99, 102, 241, 0.1)';
                    taskCard.style.border = '2px solid var(--theme-primary)';
                    setTimeout(() => {
                        taskCard.style.background = '';
                        taskCard.style.border = '';
                    }, 3000);
                }
            }, 100);
        }

        function completeTask(taskId) {
            toggleTask(taskId);
            closeDeadlineNotification();
        }

        // Time Tracking Functions
        function startTaskTimer(taskId) {
            const task = tasks.find(t => t.id === taskId);
            if (!task) return;

            activeTaskTimer = {
                taskId: taskId,
                startTime: Date.now(),
                interval: setInterval(() => updateTaskTimeDisplay(), 1000)
            };

            document.getElementById('activeTaskTimer').style.display = 'block';
            document.getElementById('activeTaskTitle').textContent = task.title;
            updateTaskTimeDisplay();
            
            showNotification(`Suivi du temps démarré pour: ${task.title}`, 'success');
        }

        function stopTaskTimer() {
            if (!activeTaskTimer) return;

            const task = tasks.find(t => t.id === activeTaskTimer.taskId);
            if (task) {
                const timeSpent = Math.floor((Date.now() - activeTaskTimer.startTime) / 1000);
                task.timeSpent = (task.timeSpent || 0) + timeSpent;
                task.sessions.push({
                    date: new Date().toISOString(),
                    duration: timeSpent
                });
                saveTasks();
                updateStats();
            }

            clearInterval(activeTaskTimer.interval);
            activeTaskTimer = null;
            document.getElementById('activeTaskTimer').style.display = 'none';
            
            showNotification('Suivi du temps arrêté', 'success');
        }

        function updateTaskTimeDisplay() {
            if (!activeTaskTimer) return;
            
            const elapsed = Math.floor((Date.now() - activeTaskTimer.startTime) / 1000);
            const hours = Math.floor(elapsed / 3600);
            const minutes = Math.floor((elapsed % 3600) / 60);
            const seconds = elapsed % 60;
            
            document.getElementById('taskTimeDisplay').textContent = 
                `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }

        function completeActiveTask() {
            if (!activeTaskTimer) return;
            
            toggleTask(activeTaskTimer.taskId);
            stopTaskTimer();
        }

        // Focus Mode Functions
        function selectFocusTask() {
            const incompleteTasks = tasks.filter(t => !t.completed);
            if (incompleteTasks.length === 0) {
                showNotification('Aucune tâche disponible', 'error');
                return;
            }
            
            // Simple selection - could be enhanced with a modal
            const taskTitles = incompleteTasks.map((task, index) => `${index + 1}. ${task.title}`).join('\n');
            const selection = prompt(`Sélectionnez une tâche (numéro):\n\n${taskTitles}`);
            
            if (selection) {
                const index = parseInt(selection) - 1;
                if (index >= 0 && index < incompleteTasks.length) {
                    startFocusMode(incompleteTasks[index]);
                }
            }
        }

        function showHighPriorityTasks() {
            const highPriorityTasks = tasks.filter(t => !t.completed && t.priority === 'high');
            renderPriorityTasks(highPriorityTasks);
        }

        function renderPriorityTasks(priorityTasks) {
            const container = document.getElementById('priorityTasksList');
            
            if (priorityTasks.length === 0) {
                container.innerHTML = '<p style="color: var(--text-secondary); text-align: center;">Aucune tâche prioritaire</p>';
                return;
            }
            
            container.innerHTML = priorityTasks.map(task => `
                <div class="task-card" style="margin-bottom: 1rem;" onclick="startFocusMode(${JSON.stringify(task).replace(/"/g, '&quot;')})">
                    <div class="task-priority ${task.priority}"></div>
                    <h4>${escapeHtml(task.title)}</h4>
                    <p style="color: var(--text-secondary); font-size: 0.9rem;">${escapeHtml(task.description || '')}</p>
                    <div class="task-meta">
                        <span class="task-badge">${getCategoryIcon(task.category)} ${getCategoryName(task.category)}</span>
                        ${task.deadline ? `<span class="task-badge">📅 ${formatDate(task.deadline)}</span>` : ''}
                    </div>
                </div>
            `).join('');
        }

        function startFocusMode(task) {
            focusSession = {
                task: task,
                startTime: Date.now(),
                paused: false
            };
            
            document.getElementById('focusTaskContainer').style.display = 'none';
            document.getElementById('focusSession').style.display = 'block';
            document.getElementById('focusTaskTitle').textContent = task.title;
            document.getElementById('focusTaskDescription').textContent = task.description || 'Aucune description';
            
            updateTodaysFocus(task);
        }

        function startFocusSession() {
            if (!focusSession) return;
            
            focusSession.paused = false;
            focusTimer = setInterval(updateFocusDisplay, 1000);
            
            if (settings.autoTimeTracking) {
                startTaskTimer(focusSession.task.id);
            }
            
            showNotification(`Session de focus démarrée: ${focusSession.task.title}`, 'success');
        }

        function pauseFocusSession() {
            if (!focusSession) return;
            
            focusSession.paused = true;
            clearInterval(focusTimer);
            showNotification('Session de focus en pause', 'warning');
        }

        function updateFocusDisplay() {
            if (!focusSession || focusSession.paused) return;
            
            const elapsed = Math.floor((Date.now() - focusSession.startTime) / 1000);
            const minutes = Math.floor(elapsed / 60);
            const seconds = elapsed % 60;
            
            document.getElementById('focusTimeDisplay').textContent = 
                `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }

        function completeFocusTask() {
            if (!focusSession) return;
            
            toggleTask(focusSession.task.id);
            endFocusSession();
        }

        function endFocusSession() {
            if (focusTimer) clearInterval(focusTimer);
            if (activeTaskTimer) stopTaskTimer();
            
            focusSession = null;
            document.getElementById('focusSession').style.display = 'none';
            document.getElementById('focusTaskContainer').style.display = 'block';
            
            showNotification('Session de focus terminée', 'success');
        }

        // Quick Actions
        function addQuickTask() {
            const title = prompt('Titre de la tâche rapide:');
            if (title && title.trim()) {
                const task = {
                    id: Date.now(),
                    title: title.trim(),
                    category: 'personal',
                    priority: 'medium',
                    deadline: '',
                    description: '',
                    recurring: 'none',
                    estimatedTime: null,
                    tags: [],
                    completed: false,
                    createdAt: new Date().toISOString(),
                    completedAt: null,
                    sortOrder: tasks.length,
                    timeSpent: 0,
                    sessions: []
                };
                
                tasks.unshift(task);
                saveTasks();
                renderTasks();
                updateStats();
                showNotification('Tâche rapide ajoutée!', 'success');
            }
        }

        function startQuickTimer() {
            const minutes = prompt('Durée du timer (minutes):', '25');
            if (minutes && parseInt(minutes) > 0) {
                document.getElementById('timerMinutes').value = minutes;
                setTimer();
                startTimer();
                switchView('timer');
                showNotification(`Timer rapide démarré: ${minutes} minutes`, 'success');
            }
        }

        // Enhanced Stats and Today's Focus
        function updateTodaysFocus(selectedTask = null) {
            const container = document.getElementById('focusContent');
            
            if (selectedTask) {
                container.innerHTML = `
                    <div class="focus-task">
                        <h3>${escapeHtml(selectedTask.title)}</h3>
                        <p>${escapeHtml(selectedTask.description || 'Aucune description')}</p>
                        <div style="margin-top: 1rem;">
                            <button class="task-btn" onclick="editTask(${task.id})" title="Modifier">✏️</button>
                            <button class="task-btn" onclick="deleteTask(${task.id})" title="Supprimer">🗑️</button>
                        </div>
                    </div>
                </div>
            `;
        }

        // Enhanced filter function with overdue filter
        function filterTasks() {
            let filtered = [...tasks];
            
            if (searchQuery) {
                filtered = filtered.filter(task => 
                    task.title.toLowerCase().includes(searchQuery) ||
                    task.description.toLowerCase().includes(searchQuery) ||
                    getCategoryName(task.category).toLowerCase().includes(searchQuery) ||
                    (task.tags && task.tags.some(tag => tag.toLowerCase().includes(searchQuery)))
                );
            }
            
            const now = new Date();
            
            switch(currentFilter) {
                case 'today':
                    const today = new Date();
                    filtered = filtered.filter(task => {
                        if (!task.deadline) return false;
                        const deadline = new Date(task.deadline);
                        return deadline.toDateString() === today.toDateString();
                    });
                    break;
                case 'week':
                    const weekFromNow = new Date();
                    weekFromNow.setDate(weekFromNow.getDate() + 7);
                    filtered = filtered.filter(task => {
                        if (!task.deadline) return false;
                        const deadline = new Date(task.deadline);
                        return deadline <= weekFromNow && deadline >= new Date();
                    });
                    break;
                case 'overdue':
                    filtered = filtered.filter(task => {
                        if (task.completed || !task.deadline) return false;
                        return new Date(task.deadline) < now;
                    });
                    break;
                case 'completed':
                    filtered = filtered.filter(task => task.completed);
                    break;
                case 'recurring':
                    filtered = filtered.filter(task => task.recurring && task.recurring !== 'none');
                    break;
                case 'work':
                case 'personal':
                case 'urgent':
                case 'shopping':
                case 'health':
                case 'learning':
                case 'family':
                    filtered = filtered.filter(task => task.category === currentFilter);
                    break;
            }
            
            return filtered.sort((a, b) => {
                if (a.completed !== b.completed) return a.completed ? 1 : -1;
                if (a.priority !== b.priority) {
                    const priorityOrder = { high: 0, medium: 1, low: 2 };
                    return priorityOrder[a.priority] - priorityOrder[b.priority];
                }
                return (a.sortOrder || 0) - (b.sortOrder || 0);
            });
        }

        // Utility function to format duration
        function formatDuration(seconds) {
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            
            if (hours > 0) {
                return `${hours}h ${minutes}m`;
            } else {
                return `${minutes}m`;
            }
        }

        // Enhanced clear form function
        function clearForm() {
            document.getElementById('taskTitle').value = '';
            document.getElementById('taskDescription').value = '';
            document.getElementById('taskDeadline').value = '';
            document.getElementById('taskCategory').value = 'work';
            document.getElementById('taskPriority').value = 'medium';
            document.getElementById('taskRecurring').value = 'none';
            document.getElementById('taskEstimatedTime').value = '';
            document.getElementById('taskTags').value = '';
        }

        // Settings Management
        function loadSettings() {
            const saved = JSON.parse(localStorage.getItem('taskMasterSettings') || '{}');
            settings = { ...settings, ...saved };
            isDarkMode = settings.darkMode || false;
            applyColorTheme(settings.colorTheme || 'blue');
        }

        function saveSettings() {
            settings.darkMode = isDarkMode;
            settings.notifications = document.getElementById('notificationsEnabled')?.checked ?? settings.notifications;
            settings.notificationAdvanceTime = parseInt(document.getElementById('notificationAdvanceTime')?.value) || settings.notificationAdvanceTime;
            settings.timerSound = document.getElementById('timerSoundEnabled')?.checked ?? settings.timerSound;
            settings.autoTimeTracking = document.getElementById('autoTimeTracking')?.checked ?? settings.autoTimeTracking;
            settings.deleteConfirmation = document.getElementById('deleteConfirmationEnabled')?.checked ?? settings.deleteConfirmation;
            settings.celebration = document.getElementById('celebrationEnabled')?.checked ?? settings.celebration;
            settings.defaultTimer = parseInt(document.getElementById('defaultTimerDuration')?.value) || settings.defaultTimer;
            settings.defaultView = document.getElementById('defaultView')?.value || settings.defaultView;
            
            localStorage.setItem('taskMasterSettings', JSON.stringify(settings));
        }

        function updateSettingsUI() {
            document.getElementById('notificationsEnabled').checked = settings.notifications;
            document.getElementById('notificationAdvanceTime').value = settings.notificationAdvanceTime;
            document.getElementById('timerSoundEnabled').checked = settings.timerSound;
            document.getElementById('autoTimeTracking').checked = settings.autoTimeTracking;
            document.getElementById('deleteConfirmationEnabled').checked = settings.deleteConfirmation;
            document.getElementById('celebrationEnabled').checked = settings.celebration;
            document.getElementById('defaultTimerDuration').value = settings.defaultTimer;
            document.getElementById('defaultView').value = settings.defaultView;
            document.getElementById('darkModeToggle').checked = isDarkMode;
            updateColorThemeUI();
        }

        // Theme Management
        function toggleTheme() {
            console.log('Toggling theme');
            isDarkMode = !isDarkMode;
            document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
            document.querySelector('.theme-toggle').textContent = isDarkMode ? '☀️' : '🌙';
            saveSettings();
        }

        function toggleDarkMode() {
            toggleTheme();
            document.getElementById('darkModeToggle').checked = isDarkMode;
        }

        function checkTheme() {
            if (settings && settings.darkMode) {
                isDarkMode = true;
                document.documentElement.setAttribute('data-theme', 'dark');
                document.querySelector('.theme-toggle').textContent = '☀️';
            }
        }

        function setColorTheme(themeName) {
            console.log('Setting color theme:', themeName);
            settings.colorTheme = themeName;
            applyColorTheme(themeName);
            updateColorThemeUI();
            saveSettings();
            showNotification(`Thème "${getThemeName(themeName)}" appliqué!`, 'success');
        }

        function applyColorTheme(themeName) {
            const theme = colorThemes[themeName];
            if (theme) {
                const root = document.documentElement;
                root.style.setProperty('--theme-primary', theme.primary);
                root.style.setProperty('--theme-secondary', theme.secondary);
                root.style.setProperty('--theme-gradient', `linear-gradient(135deg, ${theme.primary} 0%, ${theme.secondary} 100%)`);
                root.style.setProperty('--theme-gradient-hover', `linear-gradient(135deg, ${theme.primaryDark} 0%, ${theme.secondary} 100%)`);
            }
        }

        function updateColorThemeUI() {
            document.querySelectorAll('.color-theme-option').forEach(option => {
                option.classList.remove('active');
            });
            const activeTheme = document.querySelector(`[data-theme="${settings.colorTheme}"]`);
            if (activeTheme) {
                activeTheme.classList.add('active');
            }
        }

        function getThemeName(themeKey) {
            const names = {
                blue: 'Bleu Océan',
                emerald: 'Émeraude',
                sunset: 'Coucher Soleil',
                rose: 'Rose Passion',
                purple: 'Violet Royal',
                teal: 'Turquoise',
                red: 'Rouge Feu',
                dark: 'Gris Sombre'
            };
            return names[themeKey] || themeKey;
        }

        // Task Management Functions (keeping existing ones and enhancing)
        function deleteTask(id) {
            const confirmMsg = settings.deleteConfirmation ? 
                'Êtes-vous sûr de vouloir supprimer cette tâche?' : true;
            
            if (confirmMsg === true || confirm(confirmMsg)) {
                const taskIndex = tasks.findIndex(task => task.id === id);
                if (taskIndex !== -1) {
                    tasks.splice(taskIndex, 1);
                    tasks.forEach((task, index) => {
                        task.sortOrder = index;
                    });
                    saveTasks();
                    renderTasks();
                    updateStats();
                    updateTodaysFocus();
                    showNotification('Tâche supprimée', 'success');
                }
            }
        }

        function toggleTask(id) {
            const task = tasks.find(t => t.id === id);
            if (task) {
                task.completed = !task.completed;
                if (task.completed) {
                    task.completedAt = new Date().toISOString();
                    
                    if (task.recurring && task.recurring !== 'none') {
                        setTimeout(() => {
                            createRecurringTask(task);
                        }, 1000);
                    }
                    
                    if (settings.celebration) {
                        celebrate();
                    }
                } else {
                    task.completedAt = null;
                }
                saveTasks();
                renderTasks();
                updateStats();
                updateTodaysFocus();
                updateNotificationBadge();
            }
        }

        function editTask(id) {
            const task = tasks.find(t => t.id === id);
            if (task) {
                document.getElementById('taskTitle').value = task.title;
                document.getElementById('taskCategory').value = task.category;
                document.getElementById('taskPriority').value = task.priority;
                document.getElementById('taskDeadline').value = task.deadline;
                document.getElementById('taskDescription').value = task.description;
                document.getElementById('taskRecurring').value = task.recurring || 'none';
                document.getElementById('taskEstimatedTime').value = task.estimatedTime || '';
                document.getElementById('taskTags').value = task.tags ? task.tags.join(', ') : '';
                deleteTask(id);
                document.getElementById('taskTitle').focus();
                switchView('dashboard');
            }
        }

        function createRecurringTask(originalTask) {
            const newTask = {
                ...originalTask,
                id: Date.now(),
                completed: false,
                createdAt: new Date().toISOString(),
                completedAt: null,
                lastRecurring: originalTask.id,
                sortOrder: tasks.length,
                timeSpent: 0,
                sessions: []
            };
            
            if (originalTask.deadline) {
                const deadline = new Date(originalTask.deadline);
                switch (originalTask.recurring) {
                    case 'daily':
                        deadline.setDate(deadline.getDate() + 1);
                        break;
                    case 'weekly':
                        deadline.setDate(deadline.getDate() + 7);
                        break;
                    case 'monthly':
                        deadline.setMonth(deadline.getMonth() + 1);
                        break;
                }
                newTask.deadline = deadline.toISOString().slice(0, 16);
            }
            
            tasks.unshift(newTask);
            saveTasks();
            renderTasks();
            updateStats();
            showNotification(`Tâche récurrente créée: ${newTask.title}`, 'success');
        }

        // Filter Management
        function setFilter(filterType) {
            console.log('Setting filter:', filterType);
            
            document.querySelectorAll('.filter-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            event.target.classList.add('active');
            
            currentFilter = filterType;
            renderTasks();
        }

        function handleSearch() {
            searchQuery = document.getElementById('searchInput').value.toLowerCase().trim();
            renderTasks();
        }

        // Statistics Functions
        function updateStats() {
            const total = tasks.length;
            const completed = tasks.filter(t => t.completed).length;
            const pending = total - completed;
            
            document.getElementById('totalTasks').textContent = total;
            document.getElementById('completedTasks').textContent = completed;
            document.getElementById('pendingTasks').textContent = pending;
            document.getElementById('streakDays').textContent = calculateStreak();
        }

        function calculateAverageCompletionTime() {
            const completedTasks = tasks.filter(t => t.completed && t.completedAt && t.createdAt);
            
            if (completedTasks.length === 0) return '-';
            
            const totalDays = completedTasks.reduce((sum, task) => {
                const created = new Date(task.createdAt);
                const completed = new Date(task.completedAt);
                const diffTime = Math.abs(completed - created);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                return sum + diffDays;
            }, 0);
            
            const average = totalDays / completedTasks.length;
            return average < 1 ? '<1' : Math.round(average);
        }

        function getTasksThisWeek() {
            const now = new Date();
            const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);
            
            return tasks.filter(task => {
                const created = new Date(task.createdAt);
                return created >= weekStart && created <= weekEnd;
            }).length;
        }

        function renderCategoryStats() {
            const container = document.getElementById('categoryStats');
            const categories = {};
            
            tasks.forEach(task => {
                categories[task.category] = (categories[task.category] || 0) + 1;
            });
            
            const html = Object.entries(categories).map(([category, count]) => `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; padding: 1rem; background: var(--bg-primary); border-radius: 8px;">
                    <span>${getCategoryIcon(category)} ${getCategoryName(category)}</span>
                    <span style="font-weight: bold; color: var(--primary);">${count}</span>
                </div>
            `).join('');
            
            container.innerHTML = html || '<p style="text-align: center; color: var(--text-secondary);">Aucune donnée disponible</p>';
        }

        function calculateStreak() {
            const today = new Date().toDateString();
            const todayCompleted = tasks.some(t => 
                t.completed && t.completedAt && new Date(t.completedAt).toDateString() === today
            );
            return todayCompleted ? 1 : 0;
        }

        function calculateBestStreak() {
            const completedTasks = tasks.filter(t => t.completed && t.completedAt)
                                       .sort((a, b) => new Date(a.completedAt) - new Date(b.completedAt));
            
            if (completedTasks.length === 0) return 0;
            
            let streak = 0;
            let maxStreak = 0;
            let currentDate = null;
            
            completedTasks.forEach(task => {
                const taskDate = new Date(task.completedAt).toDateString();
                if (taskDate === currentDate) {
                    streak++;
                } else {
                    maxStreak = Math.max(maxStreak, streak);
                    streak = 1;
                    currentDate = taskDate;
                }
            });
            
            return Math.max(maxStreak, streak);
        }

        // Timer Functions
        function startTimer() {
            console.log('Starting timer');
            if (!timerInterval) {
                timerInterval = setInterval(() => {
                    timerSeconds--;
                    updateTimerDisplay();
                    
                    if (timerSeconds <= 0) {
                        pauseTimer();
                        showNotification('Pomodoro terminé! Prenez une pause.', 'success');
                        if (settings.timerSound) {
                            playSound();
                        }
                    }
                }, 1000);
            }
        }

        function pauseTimer() {
            console.log('Pausing timer');
            clearInterval(timerInterval);
            timerInterval = null;
        }

        function resetTimer() {
            console.log('Resetting timer');
            pauseTimer();
            const minutes = parseInt(document.getElementById('timerMinutes').value) || settings.defaultTimer;
            timerSeconds = minutes * 60;
            updateTimerDisplay();
        }

        function setTimer() {
            console.log('Setting timer');
            const minutes = parseInt(document.getElementById('timerMinutes').value);
            if (minutes && minutes > 0 && minutes <= 60) {
                pauseTimer();
                timerSeconds = minutes * 60;
                updateTimerDisplay();
                showNotification(`Timer réglé sur ${minutes} minutes`, 'success');
            } else {
                showNotification('Veuillez entrer une valeur entre 1 et 60 minutes', 'error');
            }
        }

        function updateTimerDisplay() {
            const minutes = Math.floor(timerSeconds / 60);
            const seconds = timerSeconds % 60;
            document.getElementById('timerDisplay').textContent = 
                `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }

        // Calendar Functions
        function renderCalendar() {
            const grid = document.getElementById('calendarGrid');
            const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
                              'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
            
            document.getElementById('calendarMonth').textContent = `${monthNames[currentMonth]} ${currentYear}`;
            
            const firstDay = new Date(currentYear, currentMonth, 1).getDay();
            const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
            
            let html = '';
            
            const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
            dayNames.forEach(day => {
                html += `<div class="calendar-day-header">${day}</div>`;
            });
            
            for (let i = 0; i < firstDay; i++) {
                html += `<div class="calendar-cell other-month"></div>`;
            }
            
            const today = new Date();
            for (let day = 1; day <= daysInMonth; day++) {
                const isToday = today.getDate() === day && 
                               today.getMonth() === currentMonth && 
                               today.getFullYear() === currentYear;
                
                const dayTasks = getTasksForDay(currentYear, currentMonth, day);
                const tasksHtml = dayTasks.slice(0, 2).map(task => {
                    let taskClass = 'no-deadline';
                    if (task.completed) {
                        taskClass = 'completed';
                    } else if (task.deadline) {
                        const deadline = new Date(task.deadline);
                        const now = new Date();
                        taskClass = deadline < now ? 'overdue' : 'pending';
                    }
                    
                    return `<div class="calendar-task ${taskClass}" title="${escapeHtml(task.title)} - ${task.completed ? 'Terminée' : 'En cours'}" onclick="openTask(${task.id})">${task.title.substring(0, 8)}${task.title.length > 8 ? '...' : ''}</div>`;
                }).join('');
                
                html += `
                    <div class="calendar-cell ${isToday ? 'today' : ''}">
                        <div style="font-weight: ${isToday ? 'bold' : 'normal'};">${day}</div>
                        ${tasksHtml}
                        ${dayTasks.length > 2 ? `<div class="calendar-task no-deadline" style="background: var(--text-secondary); opacity: 0.7;">+${dayTasks.length - 2}</div>` : ''}
                    </div>
                `;
            }
            
            grid.innerHTML = html;
        }

        function openTask(taskId) {
            const task = tasks.find(t => t.id === taskId);
            if (task) {
                switchView('tasks');
                setTimeout(() => {
                    const taskCard = document.querySelector(`[data-id="${taskId}"]`);
                    if (taskCard) {
                        taskCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        taskCard.style.background = 'rgba(99, 102, 241, 0.1)';
                        taskCard.style.border = '2px solid var(--theme-primary)';
                        setTimeout(() => {
                            taskCard.style.background = '';
                            taskCard.style.border = '';
                        }, 2000);
                    }
                }, 100);
            }
        }

        function getTasksForDay(year, month, day) {
            return tasks.filter(task => {
                if (!task.deadline) return false;
                const deadline = new Date(task.deadline);
                return deadline.getDate() === day && 
                       deadline.getMonth() === month && 
                       deadline.getFullYear() === year;
            });
        }

        function previousMonth() {
            console.log('Previous month');
            if (currentMonth === 0) {
                currentMonth = 11;
                currentYear--;
            } else {
                currentMonth--;
            }
            renderCalendar();
        }

        function nextMonth() {
            console.log('Next month');
            if (currentMonth === 11) {
                currentMonth = 0;
                currentYear++;
            } else {
                currentMonth++;
            }
            renderCalendar();
        }

        // Storage Functions
        function saveTasks() {
            localStorage.setItem('taskMasterTasks', JSON.stringify(tasks));
        }

        function loadTasks() {
            const saved = localStorage.getItem('taskMasterTasks');
            if (saved) {
                try {
                    tasks = JSON.parse(saved);
                    // Ensure new properties exist on loaded tasks
                    tasks.forEach(task => {
                        if (!task.timeSpent) task.timeSpent = 0;
                        if (!task.sessions) task.sessions = [];
                        if (!task.tags) task.tags = [];
                    });
                } catch (e) {
                    console.error('Error loading tasks:', e);
                    tasks = [];
                }
            }
        }

        function exportTasks() {
            console.log('Exporting tasks');
            const dataStr = JSON.stringify(tasks, null, 2);
            const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
            
            const exportFileDefaultName = `tasks_${new Date().toISOString().split('T')[0]}.json`;
            
            const linkElement = document.createElement('a');
            linkElement.setAttribute('href', dataUri);
            linkElement.setAttribute('download', exportFileDefaultName);
            linkElement.click();
            
            showNotification('Tâches exportées avec succès!', 'success');
        }

        // Cleanup functions
        function clearCompletedTasks() {
            const confirmMsg = settings.deleteConfirmation ? 
                'Êtes-vous sûr de vouloir supprimer toutes les tâches terminées?' : true;
            
            if (confirmMsg === true || confirm(confirmMsg)) {
                const beforeCount = tasks.length;
                tasks = tasks.filter(task => !task.completed);
                const deletedCount = beforeCount - tasks.length;
                saveTasks();
                renderTasks();
                updateStats();
                showNotification(`${deletedCount} tâche(s) terminée(s) supprimée(s)`, 'success');
            }
        }

        function resetAllData() {
            const confirmMsg = settings.deleteConfirmation ? 
                'ATTENTION: Cette action supprimera TOUTES vos données (tâches, paramètres, statistiques). Êtes-vous sûr?' : true;
            
            if (confirmMsg === true || confirm(confirmMsg)) {
                tasks = [];
                settings = {
                    notifications: true,
                    notificationAdvanceTime: 30,
                    timerSound: true,
                    autoTimeTracking: true,
                    deleteConfirmation: true,
                    celebration: true,
                    defaultTimer: 25,
                    defaultView: 'dashboard',
                    colorTheme: 'blue'
                };
                localStorage.removeItem('taskMasterTasks');
                localStorage.removeItem('taskMasterSettings');
                updateStats();
                renderTasks();
                updateSettingsUI();
                showNotification('Toutes les données ont été réinitialisées', 'success');
            }
        }

        // Notification Functions
        function showNotification(message, type = 'info') {
            if (!settings.notifications && type !== 'error') return;
            
            const notification = document.getElementById('notification');
            const notificationText = document.getElementById('notificationText');
            
            notificationText.textContent = message;
            notification.className = `notification show ${type}`;
            
            setTimeout(() => {
                notification.classList.remove('show');
            }, 3000);
        }

        // Utility Functions
        function escapeHtml(text) {
            const map = {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#039;'
            };
            return text.replace(/[&<>"']/g, m => map[m]);
        }

        function formatDate(dateString) {
            const date = new Date(dateString);
            const options = { 
                day: '2-digit', 
                month: 'short', 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: false 
            };
            return date.toLocaleDateString('fr-FR', options);
        }

        function getCategoryIcon(category) {
            const icons = {
                work: '💼',
                personal: '👤',
                urgent: '🚨',
                shopping: '🛒',
                health: '💪',
                learning: '📚',
                family: '👨‍👩‍👧‍👦'
            };
            return icons[category] || '📌';
        }

        function getCategoryName(category) {
            const names = {
                work: 'Travail',
                personal: 'Personnel',
                urgent: 'Urgent',
                shopping: 'Courses',
                health: 'Santé',
                learning: 'Apprentissage',
                family: 'Famille'
            };
            return names[category] || category;
        }

        function getPriorityName(priority) {
            const names = {
                low: 'Faible',
                medium: 'Moyenne',
                high: 'Haute'
            };
            return names[priority] || priority;
        }

        function getRecurringName(recurring) {
            const names = {
                daily: 'Quotidienne',
                weekly: 'Hebdomadaire',
                monthly: 'Mensuelle',
                none: ''
            };
            return names[recurring] || '';
        }

        // Drag and Drop Functions
        let touchStartY = 0;
        let touchStartX = 0;
        let isDragging = false;

        function handleDragStart(e) {
            draggedTaskId = parseInt(e.target.dataset.id);
            e.target.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        }

        function handleDragOver(e) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            
            const targetCard = e.target.closest('.task-card');
            if (targetCard && parseInt(targetCard.dataset.id) !== draggedTaskId) {
                targetCard.classList.add('drag-over');
            }
        }

        function handleDragEnd(e) {
            e.target.classList.remove('dragging');
            document.querySelectorAll('.task-card').forEach(card => {
                card.classList.remove('drag-over');
            });
        }

        function handleDrop(e) {
            e.preventDefault();
            const targetCard = e.target.closest('.task-card');
            
            if (targetCard && draggedTaskId) {
                const targetId = parseInt(targetCard.dataset.id);
                
                if (targetId !== draggedTaskId) {
                    reorderTasks(draggedTaskId, targetId);
                }
            }
            
            targetCard?.classList.remove('drag-over');
        }

        function reorderTasks(draggedId, targetId) {
            const draggedIndex = tasks.findIndex(t => t.id === draggedId);
            const targetIndex = tasks.findIndex(t => t.id === targetId);
            
            if (draggedIndex !== -1 && targetIndex !== -1) {
                const [draggedTask] = tasks.splice(draggedIndex, 1);
                tasks.splice(targetIndex, 0, draggedTask);
                
                tasks.forEach((task, index) => {
                    task.sortOrder = index;
                });
                
                saveTasks();
                renderTasks();
                showNotification('Tâches réorganisées', 'success');
            }
        }

        // Celebration function
        function celebrate() {
            const colors = ['#6366f1', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899'];
            
            for (let i = 0; i < 15; i++) {
                setTimeout(() => {
                    const particle = document.createElement('div');
                    particle.style.position = 'fixed';
                    particle.style.width = '6px';
                    particle.style.height = '6px';
                    particle.style.background = colors[Math.floor(Math.random() * colors.length)];
                    particle.style.left = Math.random() * window.innerWidth + 'px';
                    particle.style.top = '-20px';
                    particle.style.borderRadius = '50%';
                    particle.style.zIndex = '9999';
                    particle.style.pointerEvents = 'none';
                    document.body.appendChild(particle);
                    
                    let pos = -20;
                    const gravity = 0.5;
                    let velocity = Math.random() * 5 + 3;
                    
                    const animate = () => {
                        velocity += gravity;
                        pos += velocity;
                        particle.style.top = pos + 'px';
                        particle.style.opacity = Math.max(0, 1 - (pos / window.innerHeight));
                        
                        if (pos < window.innerHeight + 50) {
                            requestAnimationFrame(animate);
                        } else {
                            particle.remove();
                        }
                    };
                    
                    requestAnimationFrame(animate);
                }, i * 50);
            }
        }

        function playSound() {
            try {
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);
                
                oscillator.frequency.value = 800;
                oscillator.type = 'sine';
                
                gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
                
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.5);
            } catch (e) {
                console.log('Audio not supported');
            }
        }

        // Touch support for mobile drag and drop
        function addTouchSupport() {
            document.addEventListener('DOMContentLoaded', function() {
                const tasksContainer = document.getElementById('tasksContainer');
                if (tasksContainer) {
                    tasksContainer.addEventListener('touchstart', handleTouchStart, { passive: false });
                    tasksContainer.addEventListener('touchmove', handleTouchMove, { passive: false });
                    tasksContainer.addEventListener('touchend', handleTouchEnd, { passive: false });
                }
            });
        }

        function handleTouchStart(e) {
            const taskCard = e.target.closest('.task-card');
            if (taskCard && !e.target.closest('.task-btn')) {
                touchStartY = e.touches[0].clientY;
                touchStartX = e.touches[0].clientX;
                draggedTaskId = parseInt(taskCard.dataset.id);
                
                setTimeout(() => {
                    if (draggedTaskId) {
                        taskCard.classList.add('dragging');
                        isDragging = true;
                    }
                }, 200);
            }
        }

        function handleTouchMove(e) {
            if (!isDragging || !draggedTaskId) return;
            
            e.preventDefault();
            const touch = e.touches[0];
            const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
            const targetCard = elementBelow?.closest('.task-card');
            
            document.querySelectorAll('.task-card').forEach(card => {
                card.classList.remove('drag-over');
            });
            
            if (targetCard && parseInt(targetCard.dataset.id) !== draggedTaskId) {
                targetCard.classList.add('drag-over');
            }
        }

        function handleTouchEnd(e) {
            if (!isDragging) return;
            
            const touch = e.changedTouches[0];
            const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
            const targetCard = elementBelow?.closest('.task-card');
            
            if (targetCard && draggedTaskId) {
                const targetId = parseInt(targetCard.dataset.id);
                if (targetId !== draggedTaskId) {
                    reorderTasks(draggedTaskId, targetId);
                }
            }
            
            document.querySelectorAll('.task-card').forEach(card => {
                card.classList.remove('dragging', 'drag-over');
            });
            
            isDragging = false;
            draggedTaskId = null;
        }

        // Initialize touch support
        addTouchSupport();

        // Event listeners for settings changes
        document.addEventListener('DOMContentLoaded', function() {
            setTimeout(() => {
                const settingsInputs = [
                    'notificationsEnabled', 
                    'notificationAdvanceTime',
                    'timerSoundEnabled', 
                    'autoTimeTracking',
                    'deleteConfirmationEnabled', 
                    'celebrationEnabled', 
                    'defaultTimerDuration', 
                    'defaultView'
                ];
                
                settingsInputs.forEach(id => {
                    const element = document.getElementById(id);
                    if (element) {
                        element.addEventListener('change', saveSettings);
                    }
                });
            }, 100);
        });

        // Cleanup intervals when page unloads
        window.addEventListener('beforeunload', function() {
            if (notificationInterval) clearInterval(notificationInterval);
            if (timerInterval) clearInterval(timerInterval);
            if (activeTaskTimer) clearInterval(activeTaskTimer.interval);
            if (focusTimer) clearInterval(focusTimer);
        });
