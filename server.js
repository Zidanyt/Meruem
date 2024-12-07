require('dotenv').config();
const axios = require('axios');
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const cors = require('cors');
app.use(cors({ origin: '*' }));

app.post('/register-user', async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name, email, password: hashedPassword },
    });

    res.status(201).json({ message: 'User created successfully!', user: { id: user.id, email: user.email } });
  } catch (error) {
    res.status(400).json({ error: 'User registration failed', details: error.message });
  }
});

app.post('/register-company', async (req, res) => {
  const { name, email, password, cnpj } = req.body;

  try {
    if (!cnpj) {
      return res.status(400).json({ error: 'CNPJ is required for companies' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const company = await prisma.user.create({
      data: { name, email, password: hashedPassword, cnpj },
    });

    res.status(201).json({ message: 'Company created successfully!', company: { id: company.id, email: company.email } });
  } catch (error) {
    res.status(400).json({ error: 'Company registration failed', details: error.message });
  }
});




app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const tokenPayload = {
      id: user.id,
      email: user.email,
      isCompany: !!user.cnpj,
    };

    const token = jwt.sign(tokenPayload, process.env.SECRET, { expiresIn: '1h' });

    res.status(200).json({ message: 'Login successful', token, isCompany: !!user.cnpj });
  } catch (error) {
    res.status(500).json({ error: 'Login failed', details: error.message });
  }
});


app.post('/add-point', async (req, res) => {
  const { name, street, neighborhood, city, email, cnpj } = req.body;

  try {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!street || !neighborhood || !city) {
      return res.status(400).json({ error: 'Street, neighborhood and city are required' });
    }

    const geoResponse = await axios.get('https://api.opencagedata.com/geocode/v1/json', {
      params: {
        q: `${street}, ${neighborhood}, ${city}`,
        key: process.env.GEO_API_KEY,
        limit: 1,
      },
    });

    const geoData = geoResponse.data;

    if (!geoData.results.length) {
      return res.status(404).json({ error: 'Address not found' });
    }

    const { lat, lng } = geoData.results[0].geometry;

    const point = await prisma.point.create({
      data: {
        name,
        street,
        neighborhood,
        city,
        latitude: lat,
        longitude: lng,
        cnpj: cnpj || null,
        userId: user.id,
      },
    });

    res.status(201).json({ message: 'Point added successfully!', point });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to add point', details: error.message });
  }
});

app.get('/points', async (req, res) => {
  try {
    const points = await prisma.point.findMany({
      include: { user: true },
    });
    res.status(200).json(points);
  } catch (error) {
    console.error("Erro ao buscar pontos:", error);
    res.status(500).json({ error: 'Failed to fetch points', details: error.message });
  }
});

app.get('/recycling-points', async (req, res) => {
  try {
    const recyclingPoints = await prisma.point.findMany({
      where: { cnpj: null },
      include: { user: true },
    });
    res.status(200).json(recyclingPoints);
  } catch (error) {
    console.error("Erro ao buscar pontos de reciclagem:", error);
    res.status(500).json({ error: 'Failed to fetch recycling points', details: error.message });
  }
});


app.get('/companies', async (req, res) => {
  try {
    const companies = await prisma.point.findMany({
      where: { cnpj: { not: null } },
      include: { user: true },
    });
    res.status(200).json(companies);
  } catch (error) {
    console.error("Erro ao buscar empresas:", error);
    res.status(500).json({ error: 'Failed to fetch companies', details: error.message });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
