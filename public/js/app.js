// Main application logic
class CycleFemApp {
    constructor() {
        this.calendar = null;
        this.predictionsManager = null;
        this.notificationManager = null;
        this.currentSection = 'dashboard';
        this.loadingModal = null;
    }
    
    async init() {
        if (!Auth.checkAuth()) return;
        
        this.loadingModal = new bootstrap.Modal(document.getElementById('loadingModal'));
        this.showLoading();
        
        try {
            // Initialize components
            this.calendar = new Calendar();
            this.predictionsManager = new PredictionsManager();
            
            // Load user data
            await this.loadUserProfile();
            await this.calendar.init();
            await this.predictionsManager.init();
            
            // Setup UI
            this.setupNavigation();
            this.setupModals();
            this.setupEventHandlers();
            
            // Render initial content
            await this.updateDashboard();
            
            this.hideLoading();
        } catch (error) {
            console.error('Erreur d\'initialisation:', error);
            this.hideLoading();
            this.showError('Erreur lors du chargement de l\'application');
        }
    }
    
    showLoading() {
        if (this.loadingModal) {
            this.loadingModal.show();
        }
    }
    
    hideLoading() {
        if (this.loadingModal) {
            this.loadingModal.hide();
        }
    }
    
    async loadUserProfile() {
        try {
            const response = await Auth.makeAuthenticatedRequest('/api/profile');
            if (response && response.ok) {
                const user = await response.json();
                
                // Update UI with user data
                const userNameElements = document.querySelectorAll('#user-name, #welcome-name');
                userNameElements.forEach(el => {
                    if (el.id === 'welcome-name') {
                        el.textContent = user.name;
                    } else {
                        el.textContent = user.name;
                    }
                });
                
                // Update profile form
                this.updateProfileForm(user);
                
                // Update stored user data
                Auth.setUser(user);
            }
        } catch (error) {
            console.error('Erreur lors du chargement du profil:', error);
        }
    }
    
    updateProfileForm(user) {
        const nameInput = document.getElementById('profile-name');
        const emailInput = document.getElementById('profile-email');
        const cycleLengthInput = document.getElementById('cycle-length');
        
        if (nameInput) nameInput.value = user.name || '';
        if (emailInput) emailInput.value = user.email || '';
        if (cycleLengthInput) cycleLengthInput.value = user.cycleLength || 28;
    }
    
    setupNavigation() {
        // Navigation links
        document.querySelectorAll('[data-section]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = e.target.closest('[data-section]').dataset.section;
                this.showSection(section);
            });
        });
        
        // Logout
        const logoutBtn = document.getElementById('logout');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                Auth.logout();
            });
        }
    }
    
    async showSection(sectionName) {
        // Hide all sections
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.add('d-none');
        });
        
        // Show selected section
        const section = document.getElementById(`${sectionName}-section`);
        if (section) {
            section.classList.remove('d-none');
            this.currentSection = sectionName;
        }
        
        // Update navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        document.querySelector(`[data-section="${sectionName}"]`).classList.add('active');
        
        // Load section-specific content
        await this.loadSectionContent(sectionName);
    }
    
    async loadSectionContent(sectionName) {
        switch (sectionName) {
            case 'dashboard':
                await this.updateDashboard();
                break;
            case 'calendar':
                if (this.calendar) {
                    await this.calendar.refresh();
                }
                break;
            case 'predictions':
                if (this.predictionsManager) {
                    await this.predictionsManager.loadPredictions();
                    this.predictionsManager.renderPredictions();
                }
                break;
            case 'statistics':
                if (this.predictionsManager) {
                    await this.predictionsManager.loadStatistics();
                    this.predictionsManager.renderStatistics();
                }
                break;
            case 'history':
                await this.loadHistory();
                break;
            case 'profile':
                await this.loadUserProfile();
                break;
        }
    }
    
    async updateDashboard() {
        try {
            // Update current status
            await this.updateCurrentStatus();
            
            // Update next events
            await this.updateNextEvents();
            
        } catch (error) {
            console.error('Erreur lors de la mise à jour du tableau de bord:', error);
        }
    }
    
    async updateCurrentStatus() {
        const statusContainer = document.getElementById('current-status');
        if (!statusContainer) return;
        
        try {
            const response = await Auth.makeAuthenticatedRequest('/api/cycles');
            if (!response || !response.ok) {
                statusContainer.innerHTML = '<p class="text-muted">Impossible de charger le statut</p>';
                return;
            }
            
            const data = await response.json();
            const predictions = data.predictions;
            
            if (!predictions) {
                statusContainer.innerHTML = `
                    <div class="alert alert-info">
                        <i class="bi bi-info-circle me-2"></i>
                        Ajoutez votre premier cycle pour obtenir des informations personnalisées.
                    </div>
                `;
                return;
            }
            
            const today = new Date();
            const nextPeriod = new Date(predictions.nextPeriod);
            const ovulation = new Date(predictions.ovulation);
            const fertileStart = new Date(predictions.fertileWindow.start);
            const fertileEnd = new Date(predictions.fertileWindow.end);
            
            let status = '';
            let statusClass = 'info';
            
            if (today >= fertileStart && today <= fertileEnd) {
                status = 'Période fertile';
                statusClass = 'warning';
            } else if (Math.abs((today - ovulation) / (1000 * 60 * 60 * 24)) <= 1) {
                status = 'Ovulation';
                statusClass = 'primary';
            } else {
                const daysToNextPeriod = Math.ceil((nextPeriod - today) / (1000 * 60 * 60 * 24));
                if (daysToNextPeriod <= 3 && daysToNextPeriod > 0) {
                    status = `Règles dans ${daysToNextPeriod} jour${daysToNextPeriod > 1 ? 's' : ''}`;
                    statusClass = 'warning';
                } else if (daysToNextPeriod <= 0) {
                    status = 'Règles prévues';
                    statusClass = 'danger';
                } else {
                    status = 'Phase normale du cycle';
                    statusClass = 'success';
                }
            }
            
            statusContainer.innerHTML = `
                <div class="alert alert-${statusClass}">
                    <h6 class="mb-1">${status}</h6>
                    <small>Cycle de ${predictions.avgCycleLength} jours en moyenne</small>
                </div>
            `;
            
        } catch (error) {
            statusContainer.innerHTML = '<p class="text-danger">Erreur lors du chargement</p>';
        }
    }
    
    async updateNextEvents() {
        const eventsContainer = document.getElementById('next-events');
        if (!eventsContainer) return;
        
        try {
            const response = await Auth.makeAuthenticatedRequest('/api/cycles');
            if (!response || !response.ok) {
                eventsContainer.innerHTML = '<p class="text-muted">Impossible de charger les événements</p>';
                return;
            }
            
            const data = await response.json();
            const predictions = data.predictions;
            
            if (!predictions) {
                eventsContainer.innerHTML = '<p class="text-muted">Aucun événement prévu</p>';
                return;
            }
            
            const today = new Date();
            const events = [
                {
                    name: 'Prochaines règles',
                    date: new Date(predictions.nextPeriod),
                    icon: 'calendar-event',
                    class: 'danger'
                },
                {
                    name: 'Ovulation',
                    date: new Date(predictions.ovulation),
                    icon: 'circle',
                    class: 'warning'
                },
                {
                    name: 'Période fertile',
                    date: new Date(predictions.fertileWindow.start),
                    icon: 'heart',
                    class: 'success'
                }
            ];
            
            // Filter and sort future events
            const futureEvents = events
                .filter(event => event.date > today)
                .sort((a, b) => a.date - b.date)
                .slice(0, 3);
            
            if (futureEvents.length === 0) {
                eventsContainer.innerHTML = '<p class="text-muted">Aucun événement à venir</p>';
                return;
            }
            
            const eventsHtml = futureEvents.map(event => {
                const days = Math.ceil((event.date - today) / (1000 * 60 * 60 * 24));
                return `
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <div>
                            <i class="bi bi-${event.icon} text-${event.class} me-2"></i>
                            <span>${event.name}</span>
                        </div>
                        <small class="text-muted">${days} jour${days > 1 ? 's' : ''}</small>
                    </div>
                `;
            }).join('');
            
            eventsContainer.innerHTML = eventsHtml;
            
        } catch (error) {
            eventsContainer.innerHTML = '<p class="text-danger">Erreur lors du chargement</p>';
        }
    }
    
    async loadHistory() {
        const cyclesContainer = document.getElementById('cycles-history');
        const activitiesContainer = document.getElementById('activities-history');
        
        try {
            // Load cycles
            const cyclesResponse = await Auth.makeAuthenticatedRequest('/api/cycles');
            if (cyclesResponse && cyclesResponse.ok) {
                const cyclesData = await cyclesResponse.json();
                this.renderCyclesHistory(cyclesContainer, cyclesData.cycles || []);
            }
            
            // Load activities
            const activitiesResponse = await Auth.makeAuthenticatedRequest('/api/sexual-activities');
            if (activitiesResponse && activitiesResponse.ok) {
                const activitiesData = await activitiesResponse.json();
                this.renderActivitiesHistory(activitiesContainer, activitiesData.activities || []);
            }
            
        } catch (error) {
            console.error('Erreur lors du chargement de l\'historique:', error);
        }
    }
    
    renderCyclesHistory(container, cycles) {
        if (!container) return;
        
        if (cycles.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="bi bi-calendar-x"></i>
                    <p>Aucun cycle enregistré</p>
                </div>
            `;
            return;
        }
        
        const cyclesHtml = cycles
            .sort((a, b) => new Date(b.startDate) - new Date(a.startDate))
            .slice(0, 10)
            .map(cycle => {
                const startDate = new Date(cycle.startDate);
                const endDate = cycle.endDate ? new Date(cycle.endDate) : null;
                const duration = endDate ? 
                    Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1 : 
                    'En cours';
                
                return `
                    <div class="history-item">
                        <div class="history-date">
                            ${startDate.toLocaleDateString('fr-FR')}
                            ${endDate ? ` - ${endDate.toLocaleDateString('fr-FR')}` : ''}
                        </div>
                        <div class="history-details">
                            Durée: ${duration}${typeof duration === 'number' ? ' jour' + (duration > 1 ? 's' : '') : ''} • 
                            Flux: ${this.getFlowText(cycle.flow)}
                        </div>
                    </div>
                `;
            }).join('');
        
        container.innerHTML = cyclesHtml;
    }
    
    renderActivitiesHistory(container, activities) {
        if (!container) return;
        
        if (activities.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="bi bi-heart"></i>
                    <p>Aucune activité enregistrée</p>
                </div>
            `;
            return;
        }
        
        const activitiesHtml = activities
            .slice(0, 5)
            .map(activity => {
                const date = new Date(activity.date);
                const riskClass = this.getRiskClass(activity.pregnancyRisk);
                
                return `
                    <div class="history-item">
                        <div class="history-date">
                            ${date.toLocaleDateString('fr-FR')}
                        </div>
                        <div class="history-details">
                            Protection: ${activity.protection ? 'Oui' : 'Non'} • 
                            Risque: <span class="${riskClass}">${this.getRiskText(activity.pregnancyRisk)}</span>
                        </div>
                    </div>
                `;
            }).join('');
        
        container.innerHTML = activitiesHtml;
    }
    
    setupModals() {
        // Add period modal
        const savePeriodBtn = document.getElementById('save-period');
        if (savePeriodBtn) {
            savePeriodBtn.addEventListener('click', async () => {
                await this.handleAddPeriod();
            });
        }
        
        // Add activity modal
        const saveActivityBtn = document.getElementById('save-activity');
        if (saveActivityBtn) {
            saveActivityBtn.addEventListener('click', async () => {
                await this.handleAddActivity();
            });
        }
    }
    
    setupEventHandlers() {
        // Quick action buttons
        const addPeriodBtn = document.getElementById('add-period-btn');
        if (addPeriodBtn) {
            addPeriodBtn.addEventListener('click', () => {
                const modal = new bootstrap.Modal(document.getElementById('addPeriodModal'));
                modal.show();
            });
        }
        
        const addActivityBtn = document.getElementById('add-activity-btn');
        if (addActivityBtn) {
            addActivityBtn.addEventListener('click', () => {
                const modal = new bootstrap.Modal(document.getElementById('addActivityModal'));
                modal.show();
            });
        }
        
        const notificationsBtn = document.getElementById('notifications-btn');
        if (notificationsBtn) {
            notificationsBtn.addEventListener('click', () => {
                if (notificationManager) {
                    notificationManager.toggle();
                }
            });
        }
        
        // Profile form
        const profileForm = document.getElementById('profile-form');
        if (profileForm) {
            profileForm.addEventListener('submit', async (e) => {
                await this.handleUpdateProfile(e);
            });
        }
        
        // Notifications checkbox
        const notificationsCheckbox = document.getElementById('notifications-enabled');
        if (notificationsCheckbox) {
            notificationsCheckbox.addEventListener('change', (e) => {
                if (notificationManager) {
                    if (e.target.checked) {
                        notificationManager.enable();
                    } else {
                        notificationManager.disable();
                    }
                }
            });
        }
    }
    
    async handleAddPeriod() {
        const startDate = document.getElementById('period-start').value;
        const endDate = document.getElementById('period-end').value;
        const flow = document.getElementById('period-flow').value;
        
        if (!startDate) {
            this.showError('La date de début est requise');
            return;
        }
        
        try {
            await CycleManager.addPeriod(startDate, endDate || null, flow);
            
            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('addPeriodModal'));
            modal.hide();
            
            // Reset form
            document.getElementById('add-period-form').reset();
            
            // Refresh data
            await this.refreshData();
            
            this.showSuccess('Cycle ajouté avec succès');
            
        } catch (error) {
            this.showError(error.message);
        }
    }
    
    async handleAddActivity() {
        const date = document.getElementById('activity-date').value;
        const protection = document.getElementById('activity-protection').checked;
        
        if (!date) {
            this.showError('La date est requise');
            return;
        }
        
        try {
            const result = await CycleManager.addActivity(date, protection);
            
            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('addActivityModal'));
            modal.hide();
            
            // Reset form
            document.getElementById('add-activity-form').reset();
            
            // Refresh data
            await this.refreshData();
            
            this.showSuccess('Activité enregistrée avec succès');
            
            // Show risk notification if applicable
            if (notificationManager && result.activity.pregnancyRisk !== 'low') {
                notificationManager.showRiskNotification(result.activity.pregnancyRisk, date);
            }
            
        } catch (error) {
            this.showError(error.message);
        }
    }
    
    async handleUpdateProfile(e) {
        e.preventDefault();
        
        const name = document.getElementById('profile-name').value;
        const cycleLength = parseInt(document.getElementById('cycle-length').value);
        
        try {
            const response = await Auth.makeAuthenticatedRequest('/api/profile', {
                method: 'PUT',
                body: JSON.stringify({ name, cycleLength })
            });
            
            if (response && response.ok) {
                const data = await response.json();
                Auth.setUser(data.user);
                
                // Update UI
                const userNameElements = document.querySelectorAll('#user-name, #welcome-name');
                userNameElements.forEach(el => {
                    if (el.id === 'welcome-name') {
                        el.textContent = data.user.name;
                    } else {
                        el.textContent = data.user.name;
                    }
                });
                
                this.showSuccess('Profil mis à jour avec succès');
                
                // Refresh predictions if cycle length changed
                await this.refreshData();
                
            } else {
                const error = await response.json();
                this.showError(error.error || 'Erreur lors de la mise à jour');
            }
            
        } catch (error) {
            this.showError('Erreur lors de la mise à jour du profil');
        }
    }
    
    async refreshData() {
        try {
            if (this.calendar) {
                await this.calendar.refresh();
            }
            
            if (this.predictionsManager) {
                await this.predictionsManager.init();
                
                if (this.currentSection === 'predictions') {
                    this.predictionsManager.renderPredictions();
                } else if (this.currentSection === 'statistics') {
                    this.predictionsManager.renderStatistics();
                }
            }
            
            if (this.currentSection === 'dashboard') {
                await this.updateDashboard();
            } else if (this.currentSection === 'history') {
                await this.loadHistory();
            }
            
            // Reschedule notifications
            if (notificationManager && notificationManager.enabled) {
                await notificationManager.scheduleNotifications();
            }
            
        } catch (error) {
            console.error('Erreur lors du rafraîchissement:', error);
        }
    }
    
    showSuccess(message) {
        this.showToast(message, 'success');
    }
    
    showError(message) {
        this.showToast(message, 'danger');
    }
    
    showToast(message, type = 'info') {
        // Create toast element
        const toastHtml = `
            <div class="toast align-items-center text-bg-${type} border-0" role="alert" aria-live="assertive" aria-atomic="true">
                <div class="d-flex">
                    <div class="toast-body">
                        ${message}
                    </div>
                    <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
                </div>
            </div>
        `;
        
        // Add to toast container (create if doesn't exist)
        let toastContainer = document.getElementById('toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toast-container';
            toastContainer.className = 'toast-container position-fixed top-0 end-0 p-3';
            toastContainer.style.zIndex = '9999';
            document.body.appendChild(toastContainer);
        }
        
        toastContainer.insertAdjacentHTML('beforeend', toastHtml);
        
        // Show toast
        const toastElement = toastContainer.lastElementChild;
        const toast = new bootstrap.Toast(toastElement, { delay: 5000 });
        toast.show();
        
        // Remove element after hiding
        toastElement.addEventListener('hidden.bs.toast', () => {
            toastElement.remove();
        });
    }
    
    getFlowText(flow) {
        const flows = {
            light: 'Léger',
            medium: 'Moyen',
            heavy: 'Abondant'
        };
        return flows[flow] || flow;
    }
    
    getRiskText(risk) {
        const risks = {
            low: 'Faible',
            medium: 'Moyen',
            high: 'Élevé'
        };
        return risks[risk] || risk;
    }
    
    getRiskClass(risk) {
        const classes = {
            low: 'risk-low',
            medium: 'risk-medium',
            high: 'risk-high'
        };
        return classes[risk] || '';
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const app = new CycleFemApp();
    app.init();
});
