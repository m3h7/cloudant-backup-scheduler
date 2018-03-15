'use strict'

require('console-stamp')(console, 'yyyy-mm-dd HH:MM:ss')

const couchbackup = require('@cloudant/couchbackup')
const cron = require('node-cron')
const fs = require('fs')
const path = require('path')
const yaml = require('js-yaml')

const configFile = './config/scheduler.yaml'

// load configuration
const cfg = yaml.load(fs.readFileSync(configFile, 'utf8'))
const cronScheduleDefault = cfg.schedule.default
if (!cron.validate(cronScheduleDefault)) {
  throw new Error('Default schedule not valid.')
}

// create schedules
const databaseList = (cfg.database) ? (Array.isArray(cfg.database) ? cfg.database : [cfg.database]) : []
if (databaseList.length === 0) {
  throw new Error('No databases defined in config')
}
databaseList.forEach(entry => {
  const database = entry.name
  const schedule = entry.schedule || cronScheduleDefault
  const history = entry.history || 0
  if (!cron.validate(schedule)) {
    throw new Error('Schedule not valid for database ' + database)
  }
  console.info('Create backup task for database ' + database + ' (' + schedule + ')')
  cron.schedule(schedule, backupTask.bind(this, database, history))
})

// do the backup
function backupTask (database, history) {
  console.info('BackupTask start: ' + database)
  const dateStr = new Date().toISOString().replace(/T/, '_').replace(/:..\..+$/, '')
  var backupDir = './backup/' + database
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir)
  }
  var backupFile = database + '_backup_' + dateStr + '.json'
  var logFile = database + '_backup.log'
  var databaseURL = 'https://' + cfg.databasehost.username + ':' + cfg.databasehost.password + '@' +
    cfg.databasehost.host + '/' + database
  couchbackup.backup(
    databaseURL,
    fs.createWriteStream(path.join(backupDir, backupFile)),
    {
      parallelism: 2,
      log: path.join(backupDir, logFile)
    },
    function (error, data) {
      if (error) {
        console.error('BackupTask failed: ' + database + ' ' + error)
      } else {
        console.info('BackupTask successfully completed: ' + database + ' ' + JSON.stringify(data))
        removeOldBackupFiles(database, history)
      }
    }
  )
}

function removeOldBackupFiles (database, history) {
  const backupDir = './backup/' + database + '/'
  const re = new RegExp(database + '_backup.*json')
  let files = fs.readdirSync(backupDir).filter(file => { return file.match(re) !== null })

  if (history > 0 && history < files.length) {
    files.sort(function (a, b) {
      return fs.statSync(backupDir + a).mtime.getTime() - fs.statSync(backupDir + b).mtime.getTime()
    })
    const deleteCount = files.length - history
    files.slice(0, deleteCount).forEach(file => {
      const filepath = backupDir + file
      fs.unlink(filepath, error => {
        if (error) {
          console.error('Error deleting file: ' + error)
        } else {
          console.info('Deleted: ' + file)
        }
      })
    })
  }
}
