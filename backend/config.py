import os
from dotenv import load_dotenv

load_dotenv()

DB_HOST = os.getenv("DB_HOST", "127.0.0.1")
DB_USER = os.getenv("DB_USER", "root")
DB_PASS = os.getenv("DB_PASS", "")
DB_NAME = os.getenv("DB_NAME", "consultation_system")
DB_PORT = int(os.getenv("DB_PORT", 3306))

SECRET_KEY = os.getenv("SECRET_KEY", "urs-consultation-secret-2024")
QR_FOLDER  = os.path.join(os.path.dirname(__file__), "static", "qrcodes")

PROFESSOR_LIST = {
    "Civil Engineering Department": [
        "Engr. Von Cyrel DL. San Jose","Engr. John Troy Borromeo",
        "Engr. John Louie Cuerdo","Engr. Jasmin M. Panganiban",
        "Engr. Joanna Marie Reyes","Engr. John Carlo L. Ramos",
        "Engr. Paul Ryan M. Reyes","Engr. John Jerby A. Ytang",
        "AR. Lyndon Sheridan P. Trinidad"
    ],
    "Computer Engineering Department": [
        "Engr. Cystaleene Jade A. Santos","Engr. Paul Arvy A. Alfonso",
        "Engr. Allan P. Anorico","Engr. Lester A. Espiritu",
        "Engr. Fredelina F. De Leon"
    ],
    "Electronics Engineering Department": [
        "Engr. Erickson T. Marcos (ECE)","Dr. Marvin P. Amoin",
        "Engr. Jenadel DL. Antipolo","Engr. Jessie O. Barreto",
        "Dr. Francisco F. Culibrina","Engr. Jemuel V. Landerito",
        "Engr. Joan Baez D. Obien","Engr. Rio Camille M. Pedrocillo"
    ],
    "Electrical Engineering Department": [
        "Engr. John Niel B. Herrera","Engr. Roy John E. Balajadia",
        "Engr. Marlon A. Bautista","Engr. Norman C. Francisco",
        "Engr. Michael I. Pascua","Engr. Joshua P. Tejada"
    ],
    "Mechanical Engineering Department": [
        "Engr. Jakki Stacy Wayne A. Serra","Engr. Lean Jo B. Anievas",
        "Engr. Jayson Full B. Cabubas","Engr. Merie Ann C. Dudang",
        "Engr. Wilson Jr. C. Freo","Engr. Alliken Jett I. Ruallo",
        "Engr. Mhaezie Nhelle R. Sexon","Engr. Ver Ian J. Victorio"
    ],
    "GEC GEAS Department": [
        "Engr. Erickson T. Marcos (GEAS)","Engr. Glenda A. Cabandong",
        "Engr. Eleonor F. Dilidili","Engr. Jocelyn C. Rubio",
        "Engr. John Paul J. Sacatrapos","Prof. Marissa Yolanda C. Samonte"
    ]
}

KIOSK_PASSWORD      = os.getenv("KIOSK_PASSWORD", "admin123")
ADMIN_PASSWORD      = os.getenv("ADMIN_PASSWORD", "admin123")
WORKING_HOURS_START = "06:00"
WORKING_HOURS_END   = "19:30"
