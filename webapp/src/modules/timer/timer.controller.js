/**
 * Project Chronos - Timer Controller
 * Controls active stopwatch UI, counter intervals, and record emissions.
 */

import { TimerService } from './timer.service.js';
import { NotificationService } from '../../services/notification.service.js';
import { NativeService } from '../../services/native.service.js';

export class TimerController {
  constructor({ onEntrySaved, getCurrentUser }) {
    this.onEntrySaved = onEntrySaved;
    this.getCurrentUser = getCurrentUser;

    this.seconds = 0;
    this.intervalId = null;
    this.isRunning = false;
    this.startedAt = null;

    this.initElements();
    this.bindEvents();
    this.render();
  }

  initElements() {
    this.displayHours = document.getElementById('timer-hours');
    this.displayMinutes = document.getElementById('timer-minutes');
    this.displaySeconds = document.getElementById('timer-seconds');
    this.displayPulse = document.getElementById('timer-pulse-indicator');

    this.taskInput = document.getElementById('timer-task-input');
    this.categorySelect = document.getElementById('timer-category-select');

    this.startBtn = document.getElementById('timer-btn-start');
    this.pauseBtn = document.getElementById('timer-btn-pause');
    this.stopBtn = document.getElementById('timer-btn-stop');
    this.resetBtn = document.getElementById('timer-btn-reset');
  }

  bindEvents() {
    this.startBtn?.addEventListener('click', () => this.start());
    this.pauseBtn?.addEventListener('click', () => this.pause());
    this.stopBtn?.addEventListener('click', () => this.stopAndSave());
    this.resetBtn?.addEventListener('click', () => this.reset());
  }

  start() {
    if (this.isRunning) return;

    if (!this.startedAt) {
      this.startedAt = new Date().toISOString();
    }

    this.isRunning = true;
    NativeService.impact('light');

    this.intervalId = setInterval(() => {
      this.seconds++;
      this.render();
    }, 1000);

    this.updateControlsState();
    NotificationService.info('Cronómetro iniciado.');
  }

  pause() {
    if (!this.isRunning) return;

    clearInterval(this.intervalId);
    this.intervalId = null;
    this.isRunning = false;

    NativeService.impact('medium');
    this.updateControlsState();
    NotificationService.warning('Cronómetro pausado.');
  }

  async stopAndSave() {
    if (this.seconds === 0 && !this.isRunning) {
      NotificationService.warning('El cronómetro no tiene tiempo acumulado.');
      return;
    }

    clearInterval(this.intervalId);
    this.intervalId = null;
    this.isRunning = false;

    const endedAt = new Date().toISOString();
    const duration = this.seconds;
    const taskTitle = this.taskInput?.value?.trim() || 'Actividad Chronos';
    const category = this.categorySelect?.value || 'Desarrollo';

    let user = null;
    if (typeof this.getCurrentUser === 'function') {
      user = this.getCurrentUser();
    }

    const payload = {
      title: taskTitle,
      category: category,
      durationSeconds: duration,
      startedAt: this.startedAt || new Date().toISOString(),
      endedAt: endedAt,
      userId: user?.id || null
    };

    try {
      const saved = await TimerService.saveEntry(payload);
      NativeService.hapticNotification('success');
      NotificationService.success(`Registro guardado: ${TimerService.formatTime(duration)}`);
      
      // Native local alert
      NativeService.scheduleNotification({
        title: 'Sesión Completada en Chronos',
        body: `Guardado: "${taskTitle}" (${TimerService.formatTime(duration)})`
      });

      this.reset();

      if (typeof this.onEntrySaved === 'function') {
        this.onEntrySaved(saved);
      }
    } catch (err) {
      NativeService.hapticNotification('error');
      NotificationService.error('Error al guardar el registro de tiempo.');
    }
  }

  reset() {
    clearInterval(this.intervalId);
    this.intervalId = null;
    this.isRunning = false;
    this.seconds = 0;
    this.startedAt = null;

    if (this.taskInput) this.taskInput.value = '';
    this.render();
    this.updateControlsState();
  }

  render() {
    const hrs = Math.floor(this.seconds / 3600);
    const mins = Math.floor((this.seconds % 3600) / 60);
    const secs = this.seconds % 60;

    const pad = (n) => String(n).padStart(2, '0');

    if (this.displayHours) this.displayHours.textContent = pad(hrs);
    if (this.displayMinutes) this.displayMinutes.textContent = pad(mins);
    if (this.displaySeconds) this.displaySeconds.textContent = pad(secs);

    if (this.displayPulse) {
      this.displayPulse.classList.toggle('pulse-active', this.isRunning);
    }
  }

  updateControlsState() {
    if (this.startBtn) this.startBtn.disabled = this.isRunning;
    if (this.pauseBtn) this.pauseBtn.disabled = !this.isRunning;
    if (this.stopBtn) this.stopBtn.disabled = this.seconds === 0;
    if (this.resetBtn) this.resetBtn.disabled = this.seconds === 0 && !this.isRunning;
  }
}
