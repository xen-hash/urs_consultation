import pymysql
from config import DB_HOST, DB_USER, DB_PASS, DB_NAME, DB_PORT, PROFESSOR_LIST


def init_db():
    """Create DB and all tables if they don't exist, then seed professors."""
    # First connect without DB to create it
    conn = pymysql.connect(
        host=DB_HOST, user=DB_USER, password=DB_PASS, port=DB_PORT,
        charset="utf8mb4", autocommit=True
    )
    try:
        with conn.cursor() as cur:
            cur.execute(f"CREATE DATABASE IF NOT EXISTS `{DB_NAME}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
    finally:
        conn.close()

    # Now connect to the DB
    conn = pymysql.connect(
        host=DB_HOST, user=DB_USER, password=DB_PASS, database=DB_NAME,
        port=DB_PORT, charset="utf8mb4", autocommit=True
    )
    try:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS professors (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    department VARCHAR(255) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE KEY uq_prof (name(191), department(191))
                ) ENGINE=InnoDB
            """)

            cur.execute("""
                CREATE TABLE IF NOT EXISTS students (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    student_id VARCHAR(50) UNIQUE NOT NULL,
                    full_name VARCHAR(255) NOT NULL,
                    course VARCHAR(255),
                    year_level VARCHAR(20),
                    department VARCHAR(255),
                    qr_code_path VARCHAR(500),
                    pin_hash VARCHAR(255),
                    photo MEDIUMTEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                ) ENGINE=InnoDB
            """)

            cur.execute("""
                CREATE TABLE IF NOT EXISTS teacher_accounts (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    employee_id VARCHAR(50) UNIQUE NOT NULL,
                    professor_name VARCHAR(255) NOT NULL,
                    department VARCHAR(255) NOT NULL,
                    password_hash VARCHAR(255) NOT NULL,
                    qr_code_path VARCHAR(500),
                    photo MEDIUMTEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                ) ENGINE=InnoDB
            """)

            cur.execute("""
                CREATE TABLE IF NOT EXISTS teacher_logs (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    professor_name VARCHAR(255),
                    department VARCHAR(255),
                    action_type VARCHAR(100),
                    schedule_am DATETIME,
                    schedule_pm DATETIME,
                    manual_status VARCHAR(100),
                    `manual` TINYINT(1) DEFAULT 0,
                    weekly_schedule JSON,
                    log_time DATETIME,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                ) ENGINE=InnoDB
            """)

            cur.execute("""
                CREATE TABLE IF NOT EXISTS consultation_requests (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    student_id VARCHAR(50),
                    student_name VARCHAR(255),
                    course VARCHAR(255),
                    professor_name VARCHAR(255),
                    professor_id INT,
                    purpose TEXT,
                    category VARCHAR(100),
                    status ENUM('pending','done','declined') DEFAULT 'pending',
                    request_time DATETIME,
                    department VARCHAR(255),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                ) ENGINE=InnoDB
            """)

            # ── Migrations: add columns that may be missing in existing tables ──
            # Single-query batch migration
            needed = [
                ("students",              "pin_hash",           "VARCHAR(255)"),
                ("students",              "photo",              "MEDIUMTEXT"),
                ("teacher_accounts",      "photo",              "MEDIUMTEXT"),
                ("consultation_requests", "appointment_date",   "DATE"),
                ("consultation_requests", "appointment_time",   "VARCHAR(20)"),
                ("consultation_requests", "appointment_notes",  "TEXT"),
                ("consultation_requests", "appointment_set_at", "DATETIME"),
            ]
            tables = list({t for t, _, _ in needed})
            fmt    = ",".join(["%s"] * len(tables))
            cur.execute(
                f"SELECT TABLE_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS "
                f"WHERE TABLE_SCHEMA=%s AND TABLE_NAME IN ({fmt})",
                [DB_NAME] + tables
            )
            existing = {(r[0], r[1]) for r in cur.fetchall()}
            for table, column, definition in needed:
                if (table, column) not in existing:
                    cur.execute(f"ALTER TABLE `{table}` ADD COLUMN `{column}` {definition}")
                    print(f"[DB] Added column {table}.{column}")

            # Seed professors
            for dept, profs in PROFESSOR_LIST.items():
                for name in profs:
                    cur.execute(
                        "INSERT IGNORE INTO professors (name, department) VALUES (%s, %s)",
                        (name, dept)
                    )
        print("[DB] Tables created and professors seeded.")
    finally:
        conn.close()