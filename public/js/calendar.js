// Calendar functionality
class Calendar {
    constructor() {
        this.currentDate = new Date();
        this.cycles = [];
        this.activities = [];
        this.predictions = null;
        this.selectedDate = null;
    }
    
    async init() {
        await this.loadData();
        this.render();
        this.bindEvents();
    }
    
    async loadData() {
        try {
            const response = await Auth.makeAuthenticatedRequest('/api/cycles');
            if (response && response.ok) {
                const data = await response.json();
                this.cycles = data.cycles || [];
                this.predictions = data.predictions;
            }
            
            const activitiesResponse = await Auth.makeAuthenticatedRequest('/api/sexual-activities');
            if (activitiesResponse && activitiesResponse.ok) {
                const activitiesData = await activitiesResponse.json();
                this.activities = activitiesData.activities || [];
            }
        } catch (error) {
            console.error('Erreur lors du chargement des données:', error);
        }
    }
    
    render() {
        this.updateHeader();
        this.renderGrid();
    }
    
    updateHeader() {
        const monthYear = document.getElementById('calendar-month-year');
        if (monthYear) {
            const options = { year: 'numeric', month: 'long' };
            monthYear.textContent = this.currentDate.toLocaleDateString('fr-FR', options);
        }
    }
    
    renderGrid() {
        const grid = document.getElementById('calendar-grid');
        if (!grid) return;
        
        grid.innerHTML = '';
        
        // Add day headers
        const dayHeaders = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
        dayHeaders.forEach(day => {
            const header = document.createElement('div');
            header.className = 'calendar-header';
            header.textContent = day;
            grid.appendChild(header);
        });
        
        // Get first day of month and number of days
        const firstDay = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), 1);
        const lastDay = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + 1, 0);
        const startDate = new Date(firstDay);
        
        // Adjust to Monday start
        const dayOfWeek = firstDay.getDay();
        const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        startDate.setDate(startDate.getDate() - daysToSubtract);
        
        // Render 42 days (6 weeks)
        for (let i = 0; i < 42; i++) {
            const date = new Date(startDate);
            date.setDate(startDate.getDate() + i);
            
            const dayElement = this.createDayElement(date);
            grid.appendChild(dayElement);
        }
    }
    
    createDayElement(date) {
        const day = document.createElement('div');
        day.className = 'calendar-day';
        day.textContent = date.getDate();
        day.dataset.date = this.formatDate(date);
        
        const today = new Date();
        const isCurrentMonth = date.getMonth() === this.currentDate.getMonth();
        const isToday = this.isSameDay(date, today);
        
        if (!isCurrentMonth) {
            day.classList.add('other-month');
        }
        
        if (isToday) {
            day.classList.add('today');
        }
        
        // Add cycle indicators
        this.addCycleIndicators(day, date);
        
        // Add click handler
        day.addEventListener('click', () => this.onDayClick(date));
        
        return day;
    }
    
    addCycleIndicators(dayElement, date) {
        const dateStr = this.formatDate(date);
        
        // Check for period
        const isInPeriod = this.cycles.some(cycle => {
            const start = new Date(cycle.startDate);
            const end = cycle.endDate ? new Date(cycle.endDate) : new Date(start.getTime() + 5 * 24 * 60 * 60 * 1000);
            return date >= start && date <= end;
        });
        
        if (isInPeriod) {
            dayElement.classList.add('period');
        }
        
        // Check for predicted events
        if (this.predictions) {
            if (this.predictions.ovulation === dateStr) {
                dayElement.classList.add('ovulation');
            } else if (this.isInFertileWindow(date)) {
                dayElement.classList.add('fertile');
            }
        }
        
        // Check for sexual activity
        const hasActivity = this.activities.some(activity => activity.date === dateStr);
        if (hasActivity) {
            dayElement.classList.add('activity');
        }
    }
    
    isInFertileWindow(date) {
        if (!this.predictions || !this.predictions.fertileWindow) return false;
        
        const start = new Date(this.predictions.fertileWindow.start);
        const end = new Date(this.predictions.fertileWindow.end);
        return date >= start && date <= end;
    }
    
    isSameDay(date1, date2) {
        return date1.getFullYear() === date2.getFullYear() &&
               date1.getMonth() === date2.getMonth() &&
               date1.getDate() === date2.getDate();
    }
    
    formatDate(date) {
        return date.toISOString().split('T')[0];
    }
    
    onDayClick(date) {
        this.selectedDate = date;
        const dateStr = this.formatDate(date);
        
        // You could show a modal here or update a form
        console.log('Selected date:', dateStr);
    }
    
    bindEvents() {
        // Previous month button
        const prevBtn = document.getElementById('prev-month');
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                this.currentDate.setMonth(this.currentDate.getMonth() - 1);
                this.render();
            });
        }
        
        // Next month button
        const nextBtn = document.getElementById('next-month');
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                this.currentDate.setMonth(this.currentDate.getMonth() + 1);
                this.render();
            });
        }
    }
    
    async refresh() {
        await this.loadData();
        this.render();
    }
}

// Form handlers for adding cycles and activities
class CycleManager {
    static async addPeriod(startDate, endDate = null, flow = 'medium') {
        try {
            const response = await Auth.makeAuthenticatedRequest('/api/cycles', {
                method: 'POST',
                body: JSON.stringify({
                    startDate,
                    endDate,
                    flow
                })
            });
            
            if (response && response.ok) {
                const data = await response.json();
                return data;
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Erreur lors de l\'ajout du cycle');
            }
        } catch (error) {
            console.error('Erreur:', error);
            throw error;
        }
    }
    
    static async addActivity(date, protection = false) {
        try {
            const response = await Auth.makeAuthenticatedRequest('/api/sexual-activities', {
                method: 'POST',
                body: JSON.stringify({
                    date,
                    protection
                })
            });
            
            if (response && response.ok) {
                const data = await response.json();
                return data;
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Erreur lors de l\'ajout de l\'activité');
            }
        } catch (error) {
            console.error('Erreur:', error);
            throw error;
        }
    }
}
