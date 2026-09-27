.PHONY: install dev-backend dev-frontend docker-up docker-down migrate ingest score prioritize seed test ml-train ml-predict ml-score

install:
	cd backend && npm install
	cd frontend && npm install

dev-backend:
	cd backend && npm run dev

dev-frontend:
	cd frontend && npm run dev

docker-up:
	docker compose up -d postgres

docker-down:
	docker compose down

migrate:
	cd backend && npx prisma migrate deploy

ingest:
	cd backend && npm run ingest

score:
	cd backend && npm run score

prioritize:
	cd backend && npm run prioritize

seed:
	cd backend && npm run seed:users

test:
	cd backend && npm test

ml-train:
	python3 ml/train.py

ml-predict:
	python3 ml/predict.py --demo

ml-score:
	cd backend && ENABLE_ML_SUSCEPTIBILITY=true npm run score

