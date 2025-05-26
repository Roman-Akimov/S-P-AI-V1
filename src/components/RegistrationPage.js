// src/components/RegistrationPage.js
import React, { useState } from 'react';
import './RegistrationPage.css';

const RegistrationPage = ({ onRegister }) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        setError(''); // Сбрасываем предыдущие ошибки

        if (!name.trim() || !email.trim()) {
            setError('Имя и email обязательны для заполнения.');
            return;
        }

        // Простая валидация email
        if (!/\S+@\S+\.\S+/.test(email)) {
            setError('Пожалуйста, введите корректный email адрес.');
            return;
        }

        onRegister({ name: name.trim(), email: email.trim() });
    };

    return (
        <div className="registration-page-container">
            <div className="registration-form-container">
                <h2>Регистрация</h2>
                <p>Добро пожаловать! Пожалуйста, укажите ваше имя и email, чтобы начать.</p>
                {error && <p className="error-message">{error}</p>}
                <form onSubmit={handleSubmit} className="registration-form">
                    <div className="form-group">
                        <label htmlFor="name">Имя:</label>
                        <input
                            type="text"
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Как вас зовут?"
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="email">Email:</label>
                        <input
                            type="email"
                            id="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Ваш email адрес"
                            required
                        />
                    </div>
                    <button type="submit" className="submit-button">
                        Зарегистрироваться и продолжить
                    </button>
                </form>
            </div>
        </div>
    );
};

export default RegistrationPage;