
const express = require('express');
const sqlite3 = require('sqlite3');
const sqlite = require('sqlite');
const path = require('path');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const dbPath = path.join(__dirname, 'database.db');

let db;

// Initialize the database and start the server
async function initializeDBAndServer() {
    try {
        db = await sqlite.open({
            filename: dbPath,
            driver: sqlite3.Database
        });

        console.log('Connected to SQLite database');

        // Create the books table if it does not exist
        await db.exec(`
            CREATE TABLE IF NOT EXISTS book (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                author TEXT NOT NULL,
                price INTEGER NOT NULL,
                pages INTEGER NOT NULL
            )
        `);

        // Insert sample books only when the table is empty
        const result = await db.get(
            'SELECT COUNT(*) AS count FROM book'
        );

        if (result.count === 0) {
            const sampleBooks = [
                ['The Alchemist', 'Paulo Coelho', 250, 208],
                ['Wings of Fire', 'A. P. J. Abdul Kalam', 300, 180],
                ['Atomic Habits', 'James Clear', 450, 320],
                ['The Guide', 'R. K. Narayan', 200, 220],
                ['Ikigai', 'Hector Garcia', 350, 194],
                ['Rich Dad Poor Dad', 'Robert Kiyosaki', 400, 336],
                ['1984', 'George Orwell', 280, 328],
                ['Pride and Prejudice', 'Jane Austen', 320, 432],
                ['Deep Work', 'Cal Newport', 420, 296],
                ['Think and Grow Rich', 'Napoleon Hill', 270, 250]
            ];

            const insertBook = await db.prepare(`
                INSERT INTO book (title, author, price, pages)
                VALUES (?, ?, ?, ?)
            `);

            try {
                for (const book of sampleBooks) {
                    await insertBook.run(book);
                }
            } finally {
                await insertBook.finalize();
            }

            console.log('10 sample books inserted');
        }

        // Start only after the database and table are ready
        app.listen(PORT, () => {
            console.log(`Server running at http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error('Unable to initialize the database:', error.message);
        process.exit(1);
    }
}

// Validate a book ID
function getValidBookId(value) {
    if (!/^[1-9]\d*$/.test(value)) {
        return null;
    }

    const id = Number(value);
    return Number.isSafeInteger(id) ? id : null;
}

// Validate book details
function validateBook(body) {
    const { title, author, price, pages } = body;

    if (
        typeof title !== 'string' || !title.trim() ||
        typeof author !== 'string' || !author.trim() ||
        !Number.isSafeInteger(price) || price < 0 ||
        !Number.isSafeInteger(pages) || pages <= 0
    ) {
        return false;
    }

    return true;
}

// GET /books/ - Get all books
app.get('/books/', async (req, res) => {
    try {
        const books = await db.all('SELECT * FROM book ORDER BY id');
        res.status(200).json(books);
    } catch (error) {
        res.status(500).json({ error: 'Failed to retrieve books' });
    }
});

// GET /books/:bookId/ - Get one book
app.get('/books/:bookId/', async (req, res) => {
    const id = getValidBookId(req.params.bookId);

    if (id === null) {
        return res.status(400).json({ error: 'Invalid book ID' });
    }

    try {
        const book = await db.get(
            'SELECT * FROM book WHERE id = ?',
            [id]
        );

        if (!book) {
            return res.status(404).json({ error: 'Book not found' });
        }

        res.status(200).json(book);
    } catch (error) {
        res.status(500).json({ error: 'Failed to retrieve book' });
    }
});

// POST /books/ - Add a new book
app.post('/books/', async (req, res) => {
    if (!validateBook(req.body)) {
        return res.status(400).json({
            error: 'Provide title, author, non-negative integer price, and positive integer pages'
        });
    }

    const { title, author, price, pages } = req.body;

    try {
        const result = await db.run(
            `INSERT INTO book (title, author, price, pages)
             VALUES (?, ?, ?, ?)`,
            [title.trim(), author.trim(), price, pages]
        );

        const newBook = await db.get(
            'SELECT * FROM book WHERE id = ?',
            [result.lastID]
        );

        res.status(201).json(newBook);
    } catch (error) {
        res.status(500).json({ error: 'Failed to add book' });
    }
});

// PUT /books/:bookId/ - Update an existing book
app.put('/books/:bookId/', async (req, res) => {
    const id = getValidBookId(req.params.bookId);

    if (id === null) {
        return res.status(400).json({ error: 'Invalid book ID' });
    }

    if (!validateBook(req.body)) {
        return res.status(400).json({
            error: 'Provide title, author, non-negative integer price, and positive integer pages'
        });
    }

    const { title, author, price, pages } = req.body;

    try {
        const existingBook = await db.get(
            'SELECT * FROM book WHERE id = ?',
            [id]
        );

        if (!existingBook) {
            return res.status(404).json({ error: 'Book not found' });
        }

        await db.run(
            `UPDATE book
             SET title = ?, author = ?, price = ?, pages = ?
             WHERE id = ?`,
            [title.trim(), author.trim(), price, pages, id]
        );

        const updatedBook = await db.get(
            'SELECT * FROM book WHERE id = ?',
            [id]
        );

        res.status(200).json(updatedBook);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update book' });
    }
});

// DELETE /books/:bookId/ - Delete a book
app.delete('/books/:bookId/', async (req, res) => {
    const id = getValidBookId(req.params.bookId);

    if (id === null) {
        return res.status(400).json({ error: 'Invalid book ID' });
    }

    try {
        const result = await db.run(
            'DELETE FROM book WHERE id = ?',
            [id]
        );

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Book not found' });
        }

        res.status(200).json({
            message: 'Book deleted successfully',
            bookId: id
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete book' });
    }
});

// Handle unknown routes
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

initializeDBAndServer();
