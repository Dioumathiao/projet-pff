// Predictions and statistics management
class PredictionsManager {
    constructor() {
        this.predictions = null;
        this.statistics = null;
    }
    
    async loadPredictions() {
        try {
            const response = await Auth.makeAuthenticatedRequest('/api/cycles');
            if (response && response.ok) {
                const data = await response.json();
                this.predictions = data.predictions;
                return this.predictions;
            }
        } catch (error) {
            console.error('Erreur lors du chargement des prédictions:', error);
        }
        return null;
    }
    
    async loadStatistics() {
        try {
            const response = await Auth.makeAuthenticatedRequest('/api/statistics');
            if (response && response.ok) {
                this.statistics = await response.json();
                return this.statistics;
            }
        } catch (error) {
            console.error('Erreur lors du chargement des statistiques:', error);
        }
        return null;
    }
    
    renderPredictions() {
        const container = document.getElementById('predictions-content');
        if (!container) return;
        
        if (!this.predictions) {
            container.innerHTML = `
                <div class="col-12">
                    <div class="empty-state">
                        <i class="bi bi-calendar-x"></i>
                        <h4>Aucune prédiction disponible</h4>
                        <p>Ajoutez au moins un cycle pour obtenir des prédictions personnalisées.</p>
                    </div>
                </div>
            `;
            return;
        }
        
        const nextPeriodDate = new Date(this.predictions.nextPeriod);
        const ovulationDate = new Date(this.predictions.ovulation);
        const today = new Date();
        
        const daysToNextPeriod = Math.ceil((nextPeriodDate - today) / (1000 * 60 * 60 * 24));
        const daysToOvulation = Math.ceil((ovulationDate - today) / (1000 * 60 * 60 * 24));
        
        container.innerHTML = `
            <div class="col-lg-4 mb-4">
                <div class="card prediction-card">
                    <div class="card-body">
                        <h5 class="card-title">
                            <i class="bi bi-calendar-event me-2"></i>Prochaines règles
                        </h5>
                        <div class="prediction-date">${this.formatDate(nextPeriodDate)}</div>
                        <div class="prediction-days">
                            ${daysToNextPeriod > 0 ? `Dans ${daysToNextPeriod} jour${daysToNextPeriod > 1 ? 's' : ''}` : 
                              daysToNextPeriod === 0 ? 'Aujourd\'hui' : `Il y a ${Math.abs(daysToNextPeriod)} jour${Math.abs(daysToNextPeriod) > 1 ? 's' : ''}`}
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="col-lg-4 mb-4">
                <div class="card prediction-card">
                    <div class="card-body">
                        <h5 class="card-title">
                            <i class="bi bi-circle me-2"></i>Ovulation
                        </h5>
                        <div class="prediction-date">${this.formatDate(ovulationDate)}</div>
                        <div class="prediction-days">
                            ${daysToOvulation > 0 ? `Dans ${daysToOvulation} jour${daysToOvulation > 1 ? 's' : ''}` : 
                              daysToOvulation === 0 ? 'Aujourd\'hui' : `Il y a ${Math.abs(daysToOvulation)} jour${Math.abs(daysToOvulation) > 1 ? 's' : ''}`}
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="col-lg-4 mb-4">
                <div class="card prediction-card">
                    <div class="card-body">
                        <h5 class="card-title">
                            <i class="bi bi-heart me-2"></i>Période fertile
                        </h5>
                        <div class="prediction-date small">
                            ${this.formatDate(new Date(this.predictions.fertileWindow.start))} - 
                            ${this.formatDate(new Date(this.predictions.fertileWindow.end))}
                        </div>
                        <div class="prediction-days">
                            ${this.getFertileStatus()}
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="col-12">
                <div class="card">
                    <div class="card-body">
                        <h5 class="card-title">
                            <i class="bi bi-info-circle me-2"></i>Informations sur votre cycle
                        </h5>
                        <div class="row">
                            <div class="col-md-6 mb-3">
                                <strong>Durée moyenne du cycle:</strong> ${this.predictions.avgCycleLength} jours
                            </div>
                            <div class="col-md-6 mb-3">
                                <strong>Prochaine période fertile:</strong> 
                                ${this.formatDate(new Date(this.predictions.fertileWindow.start))} - 
                                ${this.formatDate(new Date(this.predictions.fertileWindow.end))}
                            </div>
                        </div>
                        <div class="alert alert-info">
                            <i class="bi bi-lightbulb me-2"></i>
                            <strong>À noter:</strong> Ces prédictions sont basées sur votre historique personnel et constituent des estimations. 
                            Chaque cycle peut varier naturellement.
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    renderStatistics() {
        const container = document.getElementById('statistics-content');
        if (!container) return;
        
        if (!this.statistics || this.statistics.totalCycles === 0) {
            container.innerHTML = `
                <div class="col-12">
                    <div class="empty-state">
                        <i class="bi bi-bar-chart"></i>
                        <h4>Aucune statistique disponible</h4>
                        <p>Enregistrez plusieurs cycles pour voir vos statistiques personnalisées.</p>
                    </div>
                </div>
            `;
            return;
        }
        
        container.innerHTML = `
            <div class="col-lg-3 col-md-6 mb-4">
                <div class="card stat-card">
                    <div class="card-body">
                        <span class="stat-number">${this.statistics.totalCycles}</span>
                        <div class="stat-label">Cycles enregistrés</div>
                    </div>
                </div>
            </div>
            
            <div class="col-lg-3 col-md-6 mb-4">
                <div class="card stat-card">
                    <div class="card-body">
                        <span class="stat-number">${this.statistics.averageCycleLength}</span>
                        <div class="stat-label">Durée moyenne (jours)</div>
                    </div>
                </div>
            </div>
            
            <div class="col-lg-3 col-md-6 mb-4">
                <div class="card stat-card">
                    <div class="card-body">
                        <span class="stat-number">${this.statistics.averagePeriodLength}</span>
                        <div class="stat-label">Durée des règles (jours)</div>
                    </div>
                </div>
            </div>
            
            <div class="col-lg-3 col-md-6 mb-4">
                <div class="card stat-card">
                    <div class="card-body">
                        <span class="stat-number">${this.statistics.regularity}%</span>
                        <div class="stat-label">Régularité</div>
                    </div>
                </div>
            </div>
            
            <div class="col-12">
                <div class="card">
                    <div class="card-body">
                        <h5 class="card-title">
                            <i class="bi bi-graph-up me-2"></i>Analyse de votre cycle
                        </h5>
                        <div class="row">
                            <div class="col-md-6">
                                <h6>Régularité du cycle</h6>
                                <div class="progress mb-3">
                                    <div class="progress-bar" role="progressbar" 
                                         style="width: ${this.statistics.regularity}%; background-color: var(--primary-color);">
                                    </div>
                                </div>
                                <p class="small text-muted">
                                    ${this.getRegularityText(this.statistics.regularity)}
                                </p>
                            </div>
                            <div class="col-md-6">
                                <h6>Longueur du cycle</h6>
                                <p class="mb-1">
                                    <strong>${this.statistics.averageCycleLength} jours</strong> 
                                    ${this.getCycleLengthText(this.statistics.averageCycleLength)}
                                </p>
                                <p class="small text-muted">
                                    La normale se situe entre 21 et 35 jours.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    getFertileStatus() {
        if (!this.predictions) return '';
        
        const today = new Date();
        const fertileStart = new Date(this.predictions.fertileWindow.start);
        const fertileEnd = new Date(this.predictions.fertileWindow.end);
        
        if (today >= fertileStart && today <= fertileEnd) {
            return 'Période fertile actuelle';
        } else if (today < fertileStart) {
            const days = Math.ceil((fertileStart - today) / (1000 * 60 * 60 * 24));
            return `Commence dans ${days} jour${days > 1 ? 's' : ''}`;
        } else {
            return 'Période fertile passée';
        }
    }
    
    getRegularityText(regularity) {
        if (regularity >= 80) return 'Votre cycle est très régulier';
        if (regularity >= 60) return 'Votre cycle est plutôt régulier';
        if (regularity >= 40) return 'Votre cycle présente quelques variations';
        return 'Votre cycle est irrégulier';
    }
    
    getCycleLengthText(length) {
        if (length >= 21 && length <= 35) return '(normal)';
        if (length < 21) return '(court)';
        return '(long)';
    }
    
    formatDate(date) {
        return date.toLocaleDateString('fr-FR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }
    
    async init() {
        await this.loadPredictions();
        await this.loadStatistics();
    }
}
