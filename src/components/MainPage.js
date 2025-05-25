import React from "react";
import {Link} from "react-router-dom";
import Calendar from './Calendar'; // Это наш компонент с календарем
import './MainPage.css'; // Задаем стиль для основной страницы

const MainPage = () => {
    return (
        <div className="main-container">
            <div className="sidebar">
                <ul>
                    <li><Link to="/">Календарь</Link></li>
                    <li><Link to="/chat-ai">Чат с AI</Link></li>
                    <li><Link to="analytics/">Аналитика</Link></li>
                    <li><Link to="/data">Данные пользователя</Link></li>
                </ul>
            </div>
            <div className="content">
                <Calendar/> {/* Здесь будет наш календарь */}
            </div>
        </div>
    );
};

export default MainPage;