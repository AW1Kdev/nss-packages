'use strict';
'require view';
'require form';
'require fs';
'require ui';

return view.extend({
	logWrap: null,
	logBox: null,
	statusBox: null,
	versionSelectEl: null,
	currentVersionRaw: '',

	showLog: function() {
		if (this.logWrap)
			this.logWrap.style.display = '';
	},

	hideLog: function() {
		if (this.logWrap)
			this.logWrap.style.display = 'none';
	},

	clearLog: function() {
		if (this.logBox)
			this.logBox.value = '';
	},

	addLog: function(msg) {
		if (!this.logBox)
			return;

		this.logBox.value += msg + '\n';
		this.logBox.scrollTop = this.logBox.scrollHeight;
	},

	escapeHtml: function(s) {
		if (s == null)
			return '';

		return String(s)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#39;');
	},

	detectCoreType: function(verRaw) {
		var s;

		if (!verRaw)
			return '<span style="color:#94a3b8;font-weight:bold;">Unknown</span>';

		s = String(verRaw).toLowerCase();

		if (s.indexOf('strx') !== -1)
			return '<span style="color:#22c55e;font-weight:bold;">STRX Mod</span>';

		return '<span style="color:#f59e0b;font-weight:bold;">STOCK</span>';
	},

	updateStatusBox: function(st, verRaw) {
		var coreType, rawLine;

		if (!this.statusBox)
			return;

		coreType = this.detectCoreType(verRaw || st.version_raw || st.current_version || '');
		rawLine = this.escapeHtml((verRaw || st.version_raw || '').split('\n')[0] || '-');

		this.statusBox.innerHTML =
			'<div style="line-height:1.8;">' +
				'<strong>Detected:</strong> ' + (st.current_version || '-') + '<br />' +
				'<strong>Saved:</strong> ' + (st.installed_version || '-') + '<br />' +
				'<strong>Core Type:</strong> ' + coreType + '<br />' +
				'<strong>Build:</strong> ' + rawLine + '<br />' +
				'<strong>Target:</strong> /usr/bin/xray' +
			'</div>';
	},

	refreshStatus: function() {
		var self = this;

		return Promise.all([
			fs.exec('/bin/sh', [ '/usr/bin/xraycustom', 'status' ]),
			fs.exec('/usr/bin/xray', [ 'version' ])
		]).then(function(res) {
			var st = {};
			var verRaw = '';

			try {
				st = JSON.parse(res[0].stdout || '{}');
			} catch (e) {
				self.addLog('>>> STATUS PARSE ERROR: ' + e);
				return;
			}

			verRaw = (res[1] && res[1].stdout) ? res[1].stdout : '';
			self.currentVersionRaw = verRaw;

			self.updateStatusBox(st, verRaw);
			self.addLog('>>> Status refreshed');
			self.addLog('>>> Core type detected from xray version output');
		}).catch(function(err) {
			self.addLog('>>> STATUS ERROR: ' + err);
		});
	},

	refreshVersions: function() {
		var self = this;

		return fs.exec('/bin/sh', [ '/usr/bin/xraycustom', 'versions' ]).then(function(res) {
			var versions = [];

			try {
				versions = JSON.parse(res.stdout || '[]');
			} catch (e) {
				self.addLog('>>> VERSION PARSE ERROR: ' + e);
				ui.addNotification(null, E('p', _('Failed to parse version list.')));
				return;
			}

			if (!self.versionSelectEl)
				return;

			self.versionSelectEl.innerHTML = '';

			if (Array.isArray(versions) && versions.length > 0) {
				versions.forEach(function(v) {
					var opt = document.createElement('option');
					opt.value = v;
					opt.text = v;
					self.versionSelectEl.appendChild(opt);
				});

				self.addLog('>>> Version list refreshed: ' + versions.length + ' item(s)');
				ui.addNotification(null, E('p', _('Version list refreshed successfully.')));
			} else {
				var opt = document.createElement('option');
				opt.value = '';
				opt.text = _('No versions available');
				self.versionSelectEl.appendChild(opt);

				self.addLog('>>> No versions available');
				ui.addNotification(null, E('p', _('No versions available.')));
			}
		}).catch(function(err) {
			self.addLog('>>> VERSION LOAD ERROR: ' + err);
			ui.addNotification(null, E('p', _('Failed to reload version list: ') + err));
		});
	},

	load: function() {
		return Promise.all([
			fs.exec('/bin/sh', [ '/usr/bin/xraycustom', 'status' ]).catch(function() {
				return { stdout: '{}' };
			}),
			fs.exec('/bin/sh', [ '/usr/bin/xraycustom', 'versions' ]).catch(function() {
				return { stdout: '[]' };
			}),
			fs.exec('/usr/bin/xray', [ 'version' ]).catch(function() {
				return { stdout: '' };
			})
		]);
	},

	render: function(data) {
		var self = this;
		var status = {};
		var versions = [];
		var versionRaw = '';

		try {
			status = JSON.parse(data[0].stdout || '{}');
		} catch (e) {
			status = {};
		}

		try {
			versions = JSON.parse(data[1].stdout || '[]');
		} catch (e) {
			versions = [];
		}

		versionRaw = (data[2] && data[2].stdout) ? data[2].stdout : '';
		self.currentVersionRaw = versionRaw;

		var m = new form.Map('xraycustom', _('Xray Custom'));
		m.description = _(
			'Install custom Xray core from remote list.json<br />' +
			'<small style="color:#64748b;">Credit to: dotycat • xray xtls • strx</small>'
		);

		var install = m.section(form.NamedSection, 'main', 'xraycustom', _('Install'));
		install.anonymous = true;

		var cur = install.option(form.DummyValue, '_current_version', _('Current installed version'));
		cur.rawhtml = true;
		cur.cfgvalue = function() {
			var coreType = self.detectCoreType(versionRaw);
			var rawLine = self.escapeHtml((versionRaw || '').split('\n')[0] || '-');

			return '' +
				'<div id="xray-status-box" style="padding:14px;">' +
					'<div style="line-height:1.8;">' +
						'<strong>Detected:</strong> ' + (status.current_version || '-') + '<br />' +
						'<strong>Saved:</strong> ' + (status.installed_version || '-') + '<br />' +
						'<strong>Core Type:</strong> ' + coreType + '<br />' +
						'<strong>Build:</strong> ' + rawLine + '<br />' +
						'<strong>Target:</strong> /usr/bin/xray' +
					'</div>' +
				'</div>';
		};

		var ver = install.option(form.ListValue, '_selected_version', _('Select version to install'));
		ver.rmempty = false;

		if (versions.length > 0) {
			versions.forEach(function(v) {
				ver.value(v, v);
			});
		} else {
			ver.value('', _('No versions available'));
		}

		var installBtn = install.option(form.Button, '_install_btn', _('Install selected version'));
		installBtn.inputtitle = _('Install');
		installBtn.inputstyle = 'apply';
		installBtn.onclick = function() {
			var selected = ver.formvalue('main');

			if (!selected) {
				ui.addNotification(null, E('p', _('Please select a version first.')));
				return;
			}

			self.showLog();
			self.clearLog();
			self.addLog('>>> Xray Custom Install Session >>>');
			self.addLog('>>> Installing version: ' + selected);

			return fs.exec('/bin/sh', [ '/usr/bin/xraycustom', 'install', selected ]).then(function(res) {
				var out = {};

				self.addLog(res.stdout || '(no output)');

				try {
					out = JSON.parse(res.stdout || '{}');
				} catch (e) {
					self.addLog('>>> INSTALL PARSE ERROR: ' + e);
					ui.addNotification(null, E('p', _('Install failed: invalid response')));
					return;
				}

				if (out.ok) {
					self.addLog('>>> SUCCESS: Installed ' + (out.installed_version || selected));
					ui.addNotification(null, E('p', _('Installed version ') + (out.installed_version || selected) + _(' to /usr/bin/xray')));
					return self.refreshStatus();
				}

				self.addLog('>>> ERROR: ' + (out.error || 'unknown error'));
				ui.addNotification(null, E('p', _('Install failed: ') + (out.error || 'unknown error')));
			}).catch(function(err) {
				self.addLog('>>> EXEC ERROR: ' + err);
				ui.addNotification(null, E('p', _('Install failed: ') + err));
			});
		};

		var rollbackBtn = install.option(form.Button, '_rollback_btn', _('Rollback backup'));
		rollbackBtn.inputtitle = _('Rollback');
		rollbackBtn.inputstyle = 'reset';
		rollbackBtn.onclick = function() {
			self.showLog();
			self.clearLog();
			self.addLog('>>> Xray Custom Rollback Session >>>');
			self.addLog('>>> Rolling back backup');

			return fs.exec('/bin/sh', [ '/usr/bin/xraycustom', 'rollback' ]).then(function(res) {
				var out = {};

				self.addLog(res.stdout || '(no output)');

				try {
					out = JSON.parse(res.stdout || '{}');
				} catch (e) {
					self.addLog('>>> ROLLBACK PARSE ERROR: ' + e);
					ui.addNotification(null, E('p', _('Rollback failed: invalid response')));
					return;
				}

				if (out.ok) {
					self.addLog('>>> SUCCESS: Rollback completed');
					ui.addNotification(null, E('p', _('Rollback completed successfully.')));
					return self.refreshStatus();
				}

				self.addLog('>>> ERROR: ' + (out.error || 'unknown error'));
				ui.addNotification(null, E('p', _('Rollback failed: ') + (out.error || 'unknown error')));
			}).catch(function(err) {
				self.addLog('>>> EXEC ERROR: ' + err);
				ui.addNotification(null, E('p', _('Rollback failed: ') + err));
			});
		};

		var reloadBtn = install.option(form.Button, '_reload_btn', _('Reload version list'));
		reloadBtn.inputtitle = _('Reload');
		reloadBtn.inputstyle = 'action';
		reloadBtn.onclick = function() {
			self.showLog();
			self.clearLog();
			self.addLog('>>> Xray Custom Reload Session >>>');
			self.addLog('>>> Reloading version list');
			return self.refreshVersions();
		};

		var logSection = m.section(form.TypedSection, 'xraycustom', _('Terminal Log'));
		logSection.anonymous = true;

		var log = logSection.option(form.DummyValue, '_log');
		log.rawhtml = true;
		log.cfgvalue = function() {
			return '' +
				'<div id="xray-log-wrap" style="display:none;">' +
					'<textarea id="xray-log" readonly style="' +
						'width:100%;' +
						'height:260px;' +
						'background:#020617;' +
						'color:#e2e8f0;' +
						'font-family:monospace;' +
						'border:none;' +
						'outline:none;' +
						'border-radius:10px;' +
						'padding:12px;' +
						'resize:none;' +
						'box-sizing:border-box;' +
					'"></textarea>' +
				'</div>';
		};

		return m.render().then(function(viewNode) {
			setTimeout(function() {
				var selects, i;

				self.logWrap = document.getElementById('xray-log-wrap');
				self.logBox = document.getElementById('xray-log');
				self.statusBox = document.getElementById('xray-status-box');

				selects = viewNode.querySelectorAll('select');
				for (i = 0; i < selects.length; i++) {
					if (selects[i].id && selects[i].id.indexOf('selected_version') !== -1) {
						self.versionSelectEl = selects[i];
						break;
					}
				}
			}, 100);

			return viewNode;
		});
	}
});