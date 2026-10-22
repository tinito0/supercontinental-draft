@echo off
rem Macro Deck: Windows Utils, accion Start application / Run command con este archivo y los argumentos,
rem por ejemplo  scene previa  |  popup tabla 30  |  popup off  |  toggle ticker off
node "%~dp0obs.mjs" %*
