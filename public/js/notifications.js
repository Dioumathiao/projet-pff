// Notification management
class NotificationManager {
    constructor() {
        this.permission = 'default';
        this.enabled = false;
        this.init();
    }
    
    async init() {
        // Check if notifications are supported
        if (!('Notification' in window)) {
            console.warn('Les notifications ne sont pas supportées par ce navigateur');
            return;
        }
        
        this.permission = Notification.permission;
        this.enabled = localStorage.getItem('notifications-enabled') === 'true';
        
        this.updateUI();
    }
    
    async requestPermission() {
        if (this.permission === 'granted') {
            return true;
        }
        
        try {
            this.permission = await Notification.requestPermission();
            return this.permission === 'granted';
        } catch (error) {
            console.error('Erreur lors de la demande de permission:', error);
            return false;
        }
    }
    
    async enable() {
        const granted = await this.requestPermission();
        if (granted) {
            this.enabled = true;
            localStorage.setItem('notifications-enabled', 'true');
            this.scheduleNotifications();
            this.updateUI();
            this.showTestNotification();
            return true;
        }
        return false;
    }
    
    disable() {
        this.enabled = false;
        localStorage.setItem('notifications-enabled', 'false');
        this.clearScheduledNotifications();
        this.updateUI();
    }
    
    toggle() {
        if (this.enabled) {
            this.disable();
        } else {
            this.enable();
        }
    }
    
    updateUI() {
        const checkbox = document.getElementById('notifications-enabled');
        const button = document.getElementById('notifications-btn');
        
        if (checkbox) {
            checkbox.checked = this.enabled;
        }
        
        if (button) {
            if (this.enabled) {
                button.innerHTML = '<i class="bi bi-bell-fill me-2"></i>Notifications activées';
                button.classList.remove('btn-outline-primary');
                button.classList.add('btn-success');
            } else {
                button.innerHTML = '<i class="bi bi-bell me-2"></i>Activer notifications';
                button.classList.remove('btn-success');
                button.classList.add('btn-outline-primary');
            }
        }
    }
    
    showTestNotification() {
        if (!this.enabled || this.permission !== 'granted') return;
        
        const notification = new Notification('CycleFem', {
            body: 'Les notifications sont maintenant activées ! Vous recevrez des rappels importants.',
            icon: '/favicon.ico',
            tag: 'test-notification'
        });
        
        setTimeout(() => {
            notification.close();
        }, 5000);
    }
    
    async scheduleNotifications() {
        if (!this.enabled) return;
        
        try {
            // Load user's predictions
            const response = await Auth.makeAuthenticatedRequest('/api/cycles');
            if (!response || !response.ok) return;
            
            const data = await response.json();
            const predictions = data.predictions;
            
            if (!predictions) return;
            
            this.clearScheduledNotifications();
            
            // Schedule period reminder (2 days before)
            const nextPeriodDate = new Date(predictions.nextPeriod);
            const periodReminderDate = new Date(nextPeriodDate);
            periodReminderDate.setDate(periodReminderDate.getDate() - 2);
            
            if (periodReminderDate > new Date()) {
                this.scheduleNotification(
                    periodReminderDate,
                    'Rappel règles',
                    'Vos prochaines règles sont prévues dans 2 jours',
                    'period-reminder'
                );
            }
            
            // Schedule fertile window notification
            const fertileStartDate = new Date(predictions.fertileWindow.start);
            if (fertileStartDate > new Date()) {
                this.scheduleNotification(
                    fertileStartDate,
                    'Période fertile',
                    'Votre période fertile commence aujourd\'hui',
                    'fertile-reminder'
                );
            }
            
            // Schedule ovulation notification
            const ovulationDate = new Date(predictions.ovulation);
            if (ovulationDate > new Date()) {
                this.scheduleNotification(
                    ovulationDate,
                    'Ovulation',
                    'Votre ovulation est prévue aujourd\'hui',
                    'ovulation-reminder'
                );
            }
            
        } catch (error) {
            console.error('Erreur lors de la planification des notifications:', error);
        }
    }
    
    scheduleNotification(date, title, body, tag) {
        const now = new Date();
        const delay = date.getTime() - now.getTime();
        
        if (delay <= 0) return;
        
        const timeoutId = setTimeout(() => {
            this.showNotification(title, body, tag);
        }, delay);
        
        // Store timeout ID for cleanup
        const scheduledNotifications = JSON.parse(localStorage.getItem('scheduled-notifications') || '[]');
        scheduledNotifications.push({
            timeoutId,
            date: date.toISOString(),
            tag
        });
        localStorage.setItem('scheduled-notifications', JSON.stringify(scheduledNotifications));
    }
    
    showNotification(title, body, tag) {
        if (!this.enabled || this.permission !== 'granted') return;
        
        const notification = new Notification(title, {
            body,
            icon: '/favicon.ico',
            tag,
            requireInteraction: true
        });
        
        notification.onclick = () => {
            window.focus();
            notification.close();
        };
        
        // Auto-close after 10 seconds
        setTimeout(() => {
            notification.close();
        }, 10000);
    }
    
    clearScheduledNotifications() {
        const scheduledNotifications = JSON.parse(localStorage.getItem('scheduled-notifications') || '[]');
        
        scheduledNotifications.forEach(scheduled => {
            clearTimeout(scheduled.timeoutId);
        });
        
        localStorage.removeItem('scheduled-notifications');
    }
    
    showRiskNotification(riskLevel, date) {
        if (!this.enabled || this.permission !== 'granted') return;
        
        let title, body;
        
        switch (riskLevel) {
            case 'high':
                title = 'Risque de grossesse élevé';
                body = 'Activité sexuelle durant la période fertile détectée';
                break;
            case 'medium':
                title = 'Risque de grossesse modéré';
                body = 'Activité sexuelle proche de la période fertile';
                break;
            default:
                return; // Don't notify for low risk
        }
        
        this.showNotification(title, body, `risk-${date}`);
    }
}

// Initialize notification manager
let notificationManager;
document.addEventListener('DOMContentLoaded', () => {
    notificationManager = new NotificationManager();
});
